import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { canAskDoubts, canPinMessages, canResolveDoubts } from '../access/access-policy';
import { AuthUser } from '../auth/auth-user';
import { ConversationsService } from '../conversations/conversations.service';
import { DirectChatsService } from '../conversations/direct-chats.service';
import { Conversation } from '../conversations/schemas/conversation.schema';
import { MessageChange, MessageEvent, MessageUpdatedEvent } from './message.events';
import { MessageView } from './message.views';
import { MessagesService } from './messages.service';
import { DoubtStatus, Message, MessageDocument, REACTION_EMOJIS } from './schemas/message.schema';

export const MAX_PINS_PER_GROUP = 5;
const LIST_LIMIT = 100;

interface ActionTarget {
  message: MessageDocument;
  conversation: Conversation & { _id: Types.ObjectId };
}

/** Pins, doubts and the lists behind the group info tabs. */
@Injectable()
export class MessageToolsService {
  constructor(
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly conversations: ConversationsService,
    private readonly directChats: DirectChatsService,
    private readonly messages: MessagesService,
    private readonly events: EventEmitter2,
  ) {}

  async pin(actor: AuthUser, messageId: Types.ObjectId): Promise<MessageView> {
    const { message, conversation } = await this.target(actor, messageId);
    if (!canPinMessages(actor.role, conversation.type)) {
      throw new ForbiddenException('Only mentors and admins can pin messages in a group');
    }
    assertActive(message);
    if (message.pin) return this.present(message);

    const pinned = await this.messageModel.countDocuments({
      conversationId: conversation._id,
      pin: { $ne: null },
      deletedAt: null,
    });
    if (pinned >= MAX_PINS_PER_GROUP) {
      throw new ConflictException(
        `A group can have at most ${MAX_PINS_PER_GROUP} pinned messages. Unpin one first.`,
      );
    }

    message.pin = { pinnedBy: new Types.ObjectId(actor.id), pinnedAt: new Date() };
    return this.publish(await message.save(), 'pinned', actor);
  }

  async unpin(actor: AuthUser, messageId: Types.ObjectId): Promise<MessageView> {
    const { message, conversation } = await this.target(actor, messageId);
    if (!canPinMessages(actor.role, conversation.type)) {
      throw new ForbiddenException('Only mentors and admins can unpin messages in a group');
    }
    if (!message.pin) return this.present(message);

    message.pin = null;
    return this.publish(await message.save(), 'unpinned', actor);
  }

  /** A mentee flags one of their own messages as a doubt for the mentors to answer. */
  async markDoubt(actor: AuthUser, messageId: Types.ObjectId): Promise<MessageView> {
    const { message, conversation } = await this.target(actor, messageId);
    if (!canAskDoubts(actor.role, conversation.type) || !message.senderId?.equals(actor.id)) {
      throw new ForbiddenException('Mentees can mark only their own group messages as doubts');
    }
    assertActive(message);
    if (message.doubt) return this.present(message);

    message.doubt = { status: 'open', markedAt: new Date(), resolvedBy: null, resolvedAt: null };
    return this.publish(await message.save(), 'doubt-marked', actor);
  }

  async unmarkDoubt(actor: AuthUser, messageId: Types.ObjectId): Promise<MessageView> {
    const { message } = await this.target(actor, messageId);
    if (!message.senderId?.equals(actor.id)) {
      throw new ForbiddenException('Only the person who asked can remove a doubt');
    }
    if (!message.doubt) return this.present(message);
    if (message.doubt.status === 'resolved') {
      throw new ConflictException('A resolved doubt cannot be removed');
    }

    message.doubt = null;
    return this.publish(await message.save(), 'doubt-removed', actor);
  }

  async setDoubtStatus(
    actor: AuthUser,
    messageId: Types.ObjectId,
    status: DoubtStatus,
  ): Promise<MessageView> {
    const { message, conversation } = await this.target(actor, messageId);
    if (!canResolveDoubts(actor.role, conversation.type)) {
      throw new ForbiddenException('Only mentors and admins can resolve doubts');
    }
    if (!message.doubt) throw new BadRequestException('This message is not a doubt');
    if (message.doubt.status === status) return this.present(message);

    const resolved = status === 'resolved';
    message.doubt = {
      status,
      markedAt: message.doubt.markedAt,
      resolvedBy: resolved ? new Types.ObjectId(actor.id) : null,
      resolvedAt: resolved ? new Date() : null,
    };
    return this.publish(
      await message.save(),
      resolved ? 'doubt-resolved' : 'doubt-reopened',
      actor,
    );
  }

  /** Adds one of the fixed reactions; reacting twice with the same emoji changes nothing. */
  async react(actor: AuthUser, messageId: Types.ObjectId, emoji: string): Promise<MessageView> {
    const { message } = await this.reactionTarget(actor, messageId, emoji);
    // The condition and the push are one atomic update, so double clicks or two tabs
    // can never store the same reaction twice.
    const { modifiedCount } = await this.messageModel
      .updateOne(
        {
          _id: message._id,
          deletedAt: null,
          reactions: { $not: { $elemMatch: { userId: actor.id, emoji } } },
        },
        { $push: { reactions: { userId: new Types.ObjectId(actor.id), emoji } } },
      )
      .exec();
    return this.afterReactionChange(message._id, modifiedCount > 0, actor);
  }

  async unreact(actor: AuthUser, messageId: Types.ObjectId, emoji: string): Promise<MessageView> {
    const { message } = await this.reactionTarget(actor, messageId, emoji);
    const { modifiedCount } = await this.messageModel
      .updateOne(
        { _id: message._id },
        { $pull: { reactions: { userId: new Types.ObjectId(actor.id), emoji } } },
      )
      .exec();
    return this.afterReactionChange(message._id, modifiedCount > 0, actor);
  }

  listPins(user: AuthUser, conversationId: Types.ObjectId): Promise<MessageView[]> {
    return this.list(user, conversationId, { pin: { $ne: null } }, { 'pin.pinnedAt': -1 });
  }

  listDoubts(
    user: AuthUser,
    conversationId: Types.ObjectId,
    status?: DoubtStatus,
  ): Promise<MessageView[]> {
    const filter: FilterQuery<Message> = status
      ? { 'doubt.status': status }
      : { doubt: { $ne: null } };
    return this.list(user, conversationId, filter, { _id: -1 });
  }

  listAnnouncements(user: AuthUser, conversationId: Types.ObjectId): Promise<MessageView[]> {
    return this.list(user, conversationId, { isAnnouncement: true }, { _id: -1 });
  }

  private async list(
    user: AuthUser,
    conversationId: Types.ObjectId,
    filter: FilterQuery<Message>,
    sort: Record<string, 1 | -1>,
  ): Promise<MessageView[]> {
    await this.conversations.requireAccess(user, conversationId);
    const rows = await this.messageModel
      .find({ ...filter, conversationId, deletedAt: null })
      .sort(sort)
      .limit(LIST_LIMIT)
      .lean();
    return this.messages.present(rows);
  }

  private async reactionTarget(actor: AuthUser, messageId: Types.ObjectId, emoji: string) {
    if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
      throw new BadRequestException('Choose one of the available reactions');
    }
    const target = await this.target(actor, messageId);
    assertActive(target.message);
    await this.directChats.assertCanSend(actor, target.conversation);
    return target;
  }

  private async afterReactionChange(
    messageId: Types.ObjectId,
    changed: boolean,
    actor: AuthUser,
  ): Promise<MessageView> {
    const message = await this.messageModel.findById(messageId).orFail().exec();
    return changed ? this.publish(message, 'reactions', actor) : this.present(message);
  }

  /** Loads a message the actor can see; others get 404 so its existence is not revealed. */
  private async target(actor: AuthUser, messageId: Types.ObjectId): Promise<ActionTarget> {
    const message = await this.messageModel.findById(messageId).exec();
    if (message) {
      try {
        const { conversation } = await this.conversations.requireAccess(
          actor,
          message.conversationId,
        );
        return { message, conversation };
      } catch (error) {
        if (!(error instanceof NotFoundException)) throw error;
      }
    }
    throw new NotFoundException('Message not found');
  }

  private async present(message: MessageDocument): Promise<MessageView> {
    const [view] = await this.messages.present([message.toObject()]);
    return view;
  }

  private async publish(
    message: MessageDocument,
    change: MessageChange,
    actor: AuthUser,
  ): Promise<MessageView> {
    const view = await this.present(message);
    await this.events.emitAsync(MessageEvent.Updated, {
      message: view,
      change,
      actorId: actor.id,
    } satisfies MessageUpdatedEvent);
    return view;
  }
}

function assertActive(message: MessageDocument): void {
  if (message.deletedAt) throw new BadRequestException('This message was deleted');
  if (message.type === 'system') throw new BadRequestException('System notes cannot be changed');
}
