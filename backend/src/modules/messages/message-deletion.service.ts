import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { canDeleteMessage } from '../access/access-policy';
import { AttachmentStorage } from '../attachments/attachment-storage.service';
import { AuthUser } from '../auth/auth-user';
import { ConversationsService } from '../conversations/conversations.service';
import { Report } from '../moderation/schemas/report.schema';
import { MessageEvent, MessageUpdatedEvent } from './message.events';
import { DELETED_MESSAGE_PREVIEW } from './message-preview';
import { MessageView } from './message.views';
import { MessagesService } from './messages.service';
import { Message, MessageDocument } from './schemas/message.schema';

/** Deleting a message for everyone, and tidying up everything that pointed at it. */
@Injectable()
export class MessageDeletionService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    @InjectModel(Report.name) private readonly reportModel: Model<Report>,
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
    private readonly storage: AttachmentStorage,
    private readonly events: EventEmitter2,
  ) {}

  async delete(actor: AuthUser, messageId: Types.ObjectId): Promise<MessageView> {
    const message = await this.messageModel.findById(messageId).exec();
    const conversation = message && (await this.visibleConversation(actor, message));
    if (!message || !conversation) throw new NotFoundException('Message not found');
    if (message.type === 'system') throw new BadRequestException('System notes cannot be deleted');

    const isSender = message.senderId?.equals(actor.id) ?? false;
    if (!canDeleteMessage({ role: actor.role, conversationType: conversation.type, isSender })) {
      throw new ForbiddenException(
        conversation.type === 'group'
          ? "Only mentors and admins can delete other people's messages"
          : 'You can delete only your own messages',
      );
    }
    return this.remove(actor, message);
  }

  /**
   * Removal decided by an admin reviewing a report. It also works in private chats, where
   * the admin sees only the reported message, never the rest of the conversation.
   */
  async removeReported(admin: AuthUser, messageId: Types.ObjectId): Promise<void> {
    const message = await this.messageModel.findById(messageId).exec();
    if (!message) throw new NotFoundException('Message not found');
    await this.remove(admin, message);
  }

  private async remove(actor: AuthUser, message: MessageDocument): Promise<MessageView> {
    if (message.deletedAt) return this.present(message);

    const attachment = message.attachment;
    message.deletedAt = new Date();
    message.deletedBy = new Types.ObjectId(actor.id);
    message.text = '';
    message.attachment = null;
    message.pin = null;
    message.reactions = [];
    await message.save();

    // Replies keep their place in the chat but stop quoting the deleted text.
    await this.messageModel
      .updateMany(
        { 'replyTo.messageId': message._id },
        { 'replyTo.isDeleted': true, 'replyTo.preview': '' },
      )
      .exec();
    await this.conversations.applyDeletedMessage(
      message.conversationId,
      message._id,
      message.senderId,
      DELETED_MESSAGE_PREVIEW,
    );
    // A reported file is kept so that admins can still review it.
    if (attachment && !(await this.reportModel.exists({ messageId: message._id }))) {
      await this.storage.remove(attachment.fileId);
    }

    const view = await this.present(message);
    await this.events.emitAsync(MessageEvent.Updated, {
      message: view,
      change: 'deleted',
      actorId: actor.id,
    } satisfies MessageUpdatedEvent);
    return view;
  }

  private async visibleConversation(actor: AuthUser, message: MessageDocument) {
    try {
      return (await this.conversations.requireAccess(actor, message.conversationId)).conversation;
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  private async present(message: MessageDocument): Promise<MessageView> {
    const [view] = await this.messages.present([message.toObject()]);
    return view;
  }
}
