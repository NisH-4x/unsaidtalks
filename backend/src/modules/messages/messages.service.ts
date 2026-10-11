import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/database/duplicate-key';
import { canAskDoubts, canPostAnnouncements } from '../access/access-policy';
import { cleanFileName } from '../attachments/attachment-name';
import { AttachmentStorage } from '../attachments/attachment-storage.service';
import {
  detectAttachmentType,
  isImage,
  UNSUPPORTED_FILE_MESSAGE,
} from '../attachments/attachment-types';
import { AuthUser } from '../auth/auth-user';
import { PersonRef } from '../conversations/conversation.events';
import { ConversationsService } from '../conversations/conversations.service';
import { DirectChatsService } from '../conversations/direct-chats.service';
import { ConversationType, LastMessage } from '../conversations/schemas/conversation.schema';
import { PublicUserView, toPublicUserView } from '../users/user.views';
import { UsersService } from '../users/users.service';
import {
  EditMessageDto,
  MessageHistoryQueryDto,
  MessageSearchQueryDto,
  SendAttachmentDto,
  SendMessageDto,
} from './dto/message.dto';
import { MessageCreatedEvent, MessageEvent, MessageUpdatedEvent } from './message.events';
import { buildMessagePreview } from './message-preview';
import { MessageView, toMessageView } from './message.views';
import {
  Attachment,
  EDIT_WINDOW_MS,
  Message,
  MessageDocument,
  MessageType,
  ReplySnapshot,
} from './schemas/message.schema';

type StoredMessage = Message & { _id: Types.ObjectId };

const SEARCH_PAGE_SIZE = 20;

/** The parts of an uploaded file the service needs (a Multer file satisfies this). */
export interface UploadedAttachment {
  buffer: Buffer;
  originalname: string;
}

type SendOptions = Pick<SendMessageDto, 'clientId' | 'replyToId' | 'isAnnouncement' | 'isDoubt'>;

interface MessageDraft {
  conversationId: string;
  clientId: string;
  replyTo: ReplySnapshot | null;
  isAnnouncement: boolean;
  isDoubt: boolean;
}

interface MessageContent {
  type: Exclude<MessageType, 'system'>;
  text: string;
  attachment: Attachment | null;
}

export interface MessagePage {
  /** Oldest first, ready to render top to bottom. */
  messages: MessageView[];
  hasMore: boolean;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly conversations: ConversationsService,
    private readonly directChats: DirectChatsService,
    private readonly users: UsersService,
    private readonly storage: AttachmentStorage,
    private readonly events: EventEmitter2,
  ) {}

  async send(sender: AuthUser, input: SendMessageDto): Promise<MessageView> {
    const draft = await this.prepare(sender, input.conversationId, input);
    const { view } = await this.store(sender, draft, {
      type: 'text',
      text: input.text,
      attachment: null,
    });
    return view;
  }

  /**
   * Stores an uploaded image or PDF and posts it as a message. The file's real type is
   * read from its content, and every check runs before anything is written.
   */
  async sendAttachment(
    sender: AuthUser,
    conversationId: string,
    upload: UploadedAttachment,
    input: SendAttachmentDto,
  ): Promise<MessageView> {
    // A retry of an upload whose response was lost: answer with the stored message.
    const alreadySent = await this.findSent(sender, input.clientId);
    if (alreadySent) return alreadySent;

    const mimeType = detectAttachmentType(upload.buffer);
    if (!mimeType) throw new UnsupportedMediaTypeException(UNSUPPORTED_FILE_MESSAGE);
    const draft = await this.prepare(sender, conversationId, input);

    const name = cleanFileName(upload.originalname, mimeType);
    const fileId = await this.storage.save(upload.buffer, name, {
      mimeType,
      conversationId: new Types.ObjectId(conversationId),
      uploadedBy: new Types.ObjectId(sender.id),
    });
    const image = isImage(mimeType);

    try {
      const { view, isNew } = await this.store(sender, draft, {
        type: image ? 'image' : 'file',
        text: input.text ?? '',
        attachment: {
          fileId,
          name,
          mimeType,
          size: upload.buffer.length,
          width: image ? (input.width ?? null) : null,
          height: image ? (input.height ?? null) : null,
        },
      });
      // A simultaneous retry stored the message first, so this copy of the file is unused.
      if (!isNew) await this.storage.remove(fileId);
      return view;
    } catch (error) {
      await this.storage.remove(fileId);
      throw error;
    }
  }

  /**
   * The sender corrects their message within five minutes of sending it. Quotes of it in
   * replies and the chat-list preview follow; reports keep the text as it was reported.
   */
  async edit(
    sender: AuthUser,
    messageId: Types.ObjectId,
    { text }: EditMessageDto,
  ): Promise<MessageView> {
    const message = await this.messageModel.findById(messageId).exec();
    const conversation =
      message && (await this.visibleConversation(sender, message.conversationId));
    if (!message || !conversation) throw new NotFoundException('Message not found');
    if (message.type === 'system') throw new BadRequestException('System notes cannot be edited');
    if (message.deletedAt) throw new BadRequestException('This message was deleted');
    if (!message.senderId?.equals(sender.id)) {
      throw new ForbiddenException('You can edit only your own messages');
    }
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new ForbiddenException('Messages can only be edited within 5 minutes of sending');
    }
    await this.directChats.assertCanSend(sender, conversation);
    if (message.type === 'text' && !text) {
      throw new BadRequestException('A message cannot be empty');
    }
    if (message.text === text) return toMessageView(message, toSenderView(sender));

    message.text = text;
    message.editedAt = new Date();
    await message.save();

    const preview = buildMessagePreview(message);
    await this.messageModel
      .updateMany(
        { 'replyTo.messageId': message._id, 'replyTo.isDeleted': false },
        { 'replyTo.preview': preview },
      )
      .exec();
    await this.conversations.applyEditedMessage(message.conversationId, message._id, preview);

    const view = toMessageView(message, toSenderView(sender));
    await this.events.emitAsync(MessageEvent.Updated, {
      message: view,
      change: 'edited',
      actorId: sender.id,
    } satisfies MessageUpdatedEvent);
    return view;
  }

  /** The attachment of a message the user may see; deleted messages no longer have one. */
  async findAttachment(user: AuthUser, messageId: Types.ObjectId): Promise<Attachment> {
    const message = await this.messageModel
      .findById(messageId, { conversationId: 1, attachment: 1, deletedAt: 1 })
      .lean();
    if (!message?.attachment || message.deletedAt) {
      throw new NotFoundException('Attachment not found');
    }
    await this.conversations.requireAccess(user, message.conversationId);
    return message.attachment;
  }

  /** A neutral note in the timeline, such as "Ananya added Rahul". It never counts as unread. */
  async createSystemMessage(
    conversationId: string,
    actor: PersonRef,
    text: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.create({
      conversationId,
      senderId: actor.id,
      type: 'system',
      text,
    });
    const lastMessage = this.toLastMessage(message, actor.name);
    await this.conversations.applyNewMessage(conversationId, lastMessage);

    await this.events.emitAsync(MessageEvent.Created, {
      message: toMessageView(message, null),
      preview: lastMessage.preview,
    } satisfies MessageCreatedEvent);
    return message;
  }

  async history(
    user: AuthUser,
    conversationId: Types.ObjectId,
    { before, after, limit }: MessageHistoryQueryDto,
  ): Promise<MessagePage> {
    if (before && after) throw new BadRequestException('Use either "before" or "after", not both');
    await this.conversations.requireAccess(user, conversationId);

    const filter: FilterQuery<Message> = { conversationId };
    if (before) filter._id = { $lt: new Types.ObjectId(before) };
    if (after) filter._id = { $gt: new Types.ObjectId(after) };
    const newestFirst = !after;

    // One extra row tells us whether another page exists without a separate count query.
    const rows = await this.messageModel
      .find(filter)
      .sort({ _id: newestFirst ? -1 : 1 })
      .limit(limit + 1)
      .lean();
    const page = rows.slice(0, limit);
    if (newestFirst) page.reverse();

    return { messages: await this.present(page), hasMore: rows.length > limit };
  }

  /**
   * Searches the whole conversation, not only what a browser has loaded, newest match first.
   * Deleted messages and system notes never match.
   */
  async search(
    user: AuthUser,
    conversationId: Types.ObjectId,
    { q, before }: MessageSearchQueryDto,
  ): Promise<MessagePage> {
    await this.conversations.requireAccess(user, conversationId);

    const filter: FilterQuery<Message> = {
      conversationId,
      $text: { $search: q },
      deletedAt: null,
      type: { $ne: 'system' },
    };
    if (before) filter._id = { $lt: new Types.ObjectId(before) };

    const rows = await this.messageModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(SEARCH_PAGE_SIZE + 1)
      .lean();
    return {
      messages: await this.present(rows.slice(0, SEARCH_PAGE_SIZE)),
      hasMore: rows.length > SEARCH_PAGE_SIZE,
    };
  }

  /** Builds the client view of stored messages, with each sender's public profile. */
  async present(messages: StoredMessage[]): Promise<MessageView[]> {
    const senderIds = [
      ...new Set(
        messages.flatMap((m) =>
          m.type !== 'system' && m.senderId ? [m.senderId.toHexString()] : [],
        ),
      ),
    ];
    const senders = new Map(
      (await this.users.findByIds(senderIds)).map((user) => [
        user._id.toHexString(),
        toPublicUserView(user),
      ]),
    );
    return messages.map((message) =>
      toMessageView(
        message,
        message.type === 'system' || !message.senderId
          ? null
          : (senders.get(message.senderId.toHexString()) ?? null),
      ),
    );
  }

  /** Runs every check that does not depend on the content, before anything is stored. */
  private async prepare(
    sender: AuthUser,
    conversationId: string,
    { clientId, replyToId, isAnnouncement, isDoubt }: SendOptions,
  ): Promise<MessageDraft> {
    const { conversation } = await this.conversations.requireAccess(sender, conversationId);
    await this.directChats.assertCanSend(sender, conversation);
    assertSendOptions(sender, conversation.type, { isAnnouncement, isDoubt });
    const replyTo = replyToId ? await this.replySnapshot(conversationId, replyToId) : null;
    return {
      conversationId,
      clientId,
      replyTo,
      isAnnouncement: isAnnouncement ?? false,
      isDoubt: isDoubt ?? false,
    };
  }

  private async store(
    sender: AuthUser,
    draft: MessageDraft,
    content: MessageContent,
  ): Promise<{ view: MessageView; isNew: boolean }> {
    const { conversationId, clientId } = draft;
    let message: MessageDocument;
    try {
      message = await this.messageModel.create({
        ...content,
        conversationId,
        senderId: sender.id,
        clientId,
        replyTo: draft.replyTo,
        isAnnouncement: draft.isAnnouncement,
        doubt: draft.isDoubt
          ? { status: 'open', markedAt: new Date(), resolvedBy: null, resolvedAt: null }
          : null,
      });
    } catch (error) {
      // The same draft sent twice (a retry after a lost acknowledgement) returns the
      // message that was already stored instead of creating a duplicate.
      const alreadySent = isDuplicateKeyError(error) ? await this.findSent(sender, clientId) : null;
      if (alreadySent) return { view: alreadySent, isNew: false };
      throw error;
    }

    const lastMessage = this.toLastMessage(message, sender.name);
    await this.conversations.applyNewMessage(conversationId, lastMessage, {
      senderId: sender.id,
    });

    const view = toMessageView(message, toSenderView(sender));
    await this.events.emitAsync(MessageEvent.Created, {
      message: view,
      preview: lastMessage.preview,
      clientId,
    } satisfies MessageCreatedEvent);
    return { view, isNew: true };
  }

  private async visibleConversation(user: AuthUser, conversationId: Types.ObjectId) {
    try {
      return (await this.conversations.requireAccess(user, conversationId)).conversation;
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  private async findSent(sender: AuthUser, clientId: string): Promise<MessageView | null> {
    const message = await this.messageModel.findOne({ senderId: sender.id, clientId }).lean();
    return message ? toMessageView(message, toSenderView(sender)) : null;
  }

  private async replySnapshot(conversationId: string, replyToId: string): Promise<ReplySnapshot> {
    const original = await this.messageModel.findOne({ _id: replyToId, conversationId }).lean();
    if (!original || original.type === 'system') {
      throw new BadRequestException('You can only reply to a message in this conversation');
    }
    if (original.deletedAt) throw new BadRequestException('This message was deleted');

    const author = original.senderId ? await this.users.findById(original.senderId) : null;
    return {
      messageId: original._id,
      senderId: original.senderId,
      senderName: author?.name ?? original.import?.senderName ?? '',
      type: original.type,
      preview: buildMessagePreview(original),
      isDeleted: false,
    };
  }

  private toLastMessage(message: MessageDocument, senderName: string): LastMessage {
    return {
      messageId: message._id,
      senderId: message.senderId,
      senderName,
      type: message.type,
      preview: buildMessagePreview(message),
      sentAt: message.createdAt,
    };
  }
}

function toSenderView(user: AuthUser): PublicUserView {
  return { id: user.id, name: user.name, role: user.role };
}

function assertSendOptions(
  sender: AuthUser,
  type: ConversationType,
  { isAnnouncement, isDoubt }: { isAnnouncement?: boolean; isDoubt?: boolean },
): void {
  if (isAnnouncement && isDoubt) {
    throw new BadRequestException('A message cannot be both an announcement and a doubt');
  }
  if (isAnnouncement && !canPostAnnouncements(sender.role, type)) {
    throw new ForbiddenException('Only mentors and admins can post announcements in a group');
  }
  if (isDoubt && !canAskDoubts(sender.role, type)) {
    throw new ForbiddenException('Only mentees can ask doubts in a group');
  }
}
