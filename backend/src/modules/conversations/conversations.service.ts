import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { conversationAccess, ConversationAccess } from '../access/access-policy';
import { AuthUser } from '../auth/auth-user';
import { toContactView } from '../users/user.views';
import { UsersService } from '../users/users.service';
import {
  ConversationEvent,
  ConversationReadEvent,
  UnreadChangedEvent,
} from './conversation.events';
import {
  ChatListItem,
  ConversationDetailsView,
  toChatListItem,
  toConversationDetails,
} from './conversation.views';
import { DirectChatsService } from './direct-chats.service';
import { Conversation, LastMessage } from './schemas/conversation.schema';
import { Membership } from './schemas/membership.schema';

type StoredConversation = Conversation & { _id: Types.ObjectId };
type StoredMembership = Membership & { _id: Types.ObjectId };

export interface ConversationAccessResult {
  conversation: StoredConversation;
  access: Exclude<ConversationAccess, 'none'>;
  membership: StoredMembership | null;
}

@Injectable()
export class ConversationsService {
  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<Conversation>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    private readonly users: UsersService,
    private readonly directChats: DirectChatsService,
    private readonly events: EventEmitter2,
  ) {}

  /** The signed-in user's own groups and direct chats, most recently active first. */
  async listForUser(user: AuthUser): Promise<ChatListItem[]> {
    const memberships = await this.membershipModel.find({ userId: user.id }).lean();
    if (memberships.length === 0) return [];

    const unreadByConversation = new Map(
      memberships.map((m) => [m.conversationId.toHexString(), m.unreadCount]),
    );
    // Like WhatsApp, a private chat someone else opened appears only once it has a message.
    const conversations = (
      await this.conversationModel
        .find({ _id: { $in: memberships.map((m) => m.conversationId) } })
        .sort({ lastActivityAt: -1 })
        .lean()
    ).filter((c) => c.type === 'group' || c.lastMessage || c.createdBy?.equals(user.id));

    const groupIds = conversations.filter((c) => c.type === 'group').map((c) => c._id);
    const memberCounts = await this.countMembers(groupIds);

    const otherUserIds = conversations
      .filter((c) => c.type === 'direct')
      .flatMap((c) => (c.participantIds ?? []).filter((id) => !id.equals(user.id)));
    const otherUsers = new Map(
      (await this.users.findByIds(otherUserIds)).map((u) => [
        u._id.toHexString(),
        toContactView(u),
      ]),
    );

    return conversations.map((conversation) => {
      const id = conversation._id.toHexString();
      const otherUserId = conversation.participantIds
        ?.find((participant) => !participant.equals(user.id))
        ?.toHexString();
      return toChatListItem(conversation, unreadByConversation.get(id) ?? 0, {
        memberCount: memberCounts.get(id),
        otherUser: otherUserId ? otherUsers.get(otherUserId) : undefined,
      });
    });
  }

  /** Ids of every conversation the user belongs to; used to place their sockets in rooms. */
  async listConversationIdsForUser(userId: string): Promise<string[]> {
    const memberships = await this.membershipModel.find({ userId }, { conversationId: 1 }).lean();
    return memberships.map((membership) => membership.conversationId.toHexString());
  }

  /** Everyone who shares at least one conversation with the user (their "contacts"). */
  async listContactIds(userId: string): Promise<string[]> {
    const conversationIds = await this.membershipModel.distinct('conversationId', { userId });
    const contactIds = await this.membershipModel.distinct('userId', {
      conversationId: { $in: conversationIds },
      userId: { $ne: new Types.ObjectId(userId) },
    });
    return contactIds.map((id: Types.ObjectId) => id.toHexString());
  }

  async getDetails(
    user: AuthUser,
    conversationId: Types.ObjectId,
  ): Promise<ConversationDetailsView> {
    const { conversation, access, membership } = await this.requireAccess(user, conversationId);

    const memberships = await this.membershipModel.find({ conversationId }).lean();
    const usersById = new Map(
      (await this.users.findByIds(memberships.map((m) => m.userId))).map((u) => [
        u._id.toHexString(),
        u,
      ]),
    );
    const members = memberships.flatMap((m) => {
      const member = usersById.get(m.userId.toHexString());
      return member
        ? [{ user: member, joinedAt: m.createdAt, lastReadMessageId: m.lastReadMessageId }]
        : [];
    });

    const canSend = await this.directChats.canSend(user, conversation);
    return toConversationDetails(conversation, access, members, user.id, membership, canSend);
  }

  /** Loads a conversation the user may see, or answers 404 so its existence is not revealed. */
  async requireAccess(
    user: AuthUser,
    conversationId: Types.ObjectId | string,
  ): Promise<ConversationAccessResult> {
    const conversation = await this.conversationModel.findById(conversationId).lean();
    if (conversation) {
      const membership = await this.membershipModel
        .findOne({ conversationId, userId: user.id })
        .lean();
      const access = conversationAccess({
        role: user.role,
        isMember: membership !== null,
        conversationType: conversation.type,
      });
      if (access !== 'none') return { conversation, access, membership };
    }
    throw new NotFoundException('Conversation not found');
  }

  /**
   * Makes a new message the conversation's latest. For messages from a person, everyone
   * else gets one more unread message in a single update, and the sender is treated as
   * having read everything up to their own message.
   */
  async applyNewMessage(
    conversationId: string,
    lastMessage: LastMessage,
    fromPerson?: { senderId: string },
  ): Promise<void> {
    // Messages sent at almost the same moment can be processed out of order, so an update
    // never replaces a later message (higher id) with an earlier one.
    await this.conversationModel
      .updateOne(
        {
          _id: conversationId,
          $or: [{ lastMessage: null }, { 'lastMessage.messageId': { $lt: lastMessage.messageId } }],
        },
        { lastMessage, lastActivityAt: lastMessage.sentAt },
      )
      .exec();
    if (!fromPerson) return;

    await this.membershipModel
      .updateMany(
        { conversationId, userId: { $ne: fromPerson.senderId } },
        { $inc: { unreadCount: 1 } },
      )
      .exec();
    await this.membershipModel
      .updateOne(
        { conversationId, userId: fromPerson.senderId },
        { $set: { unreadCount: 0 }, $max: { lastReadMessageId: lastMessage.messageId } },
      )
      .exec();
  }

  /**
   * Undoes what a now-deleted message did to the conversation: the chat list stops showing
   * its text, and members who had not read it yet lose one unread message.
   */
  async applyDeletedMessage(
    conversationId: Types.ObjectId,
    messageId: Types.ObjectId,
    senderId: Types.ObjectId | null,
    deletedPreview: string,
  ): Promise<void> {
    await this.conversationModel
      .updateOne(
        { _id: conversationId, 'lastMessage.messageId': messageId },
        { 'lastMessage.preview': deletedPreview, 'lastMessage.type': 'text' },
      )
      .exec();

    const stillUnread = {
      conversationId,
      userId: { $ne: senderId },
      unreadCount: { $gt: 0 },
      $or: [{ lastReadMessageId: null }, { lastReadMessageId: { $lt: messageId } }],
    };
    const affected = await this.membershipModel.find(stillUnread, { _id: 1, userId: 1 }).lean();
    if (affected.length === 0) return;

    await this.membershipModel
      .updateMany({ _id: { $in: affected.map((m) => m._id) } }, { $inc: { unreadCount: -1 } })
      .exec();
    const updated = await this.membershipModel
      .find({ _id: { $in: affected.map((m) => m._id) } }, { userId: 1, unreadCount: 1 })
      .lean();
    for (const membership of updated) {
      await this.events.emitAsync(ConversationEvent.UnreadChanged, {
        conversationId: conversationId.toHexString(),
        userId: membership.userId.toHexString(),
        unreadCount: membership.unreadCount,
      } satisfies UnreadChangedEvent);
    }
  }

  /** Keeps the chat-list preview in step when its latest message is edited. */
  async applyEditedMessage(
    conversationId: Types.ObjectId,
    messageId: Types.ObjectId,
    preview: string,
  ): Promise<void> {
    await this.conversationModel
      .updateOne(
        { _id: conversationId, 'lastMessage.messageId': messageId },
        { 'lastMessage.preview': preview },
      )
      .exec();
  }

  /** Type, group name and participants of several conversations, for screens listing them by id. */
  findSummaries(ids: Types.ObjectId[]) {
    return this.conversationModel
      .find({ _id: { $in: ids } }, { type: 1, name: 1, participantIds: 1 })
      .lean();
  }

  async listMemberIds(conversationId: string): Promise<string[]> {
    const memberships = await this.membershipModel.find({ conversationId }, { userId: 1 }).lean();
    return memberships.map((membership) => membership.userId.toHexString());
  }

  async markRead(user: AuthUser, conversationId: Types.ObjectId): Promise<void> {
    const { conversation, membership } = await this.requireAccess(user, conversationId);
    if (!membership) return;

    const lastReadMessageId =
      conversation.lastMessage?.messageId ?? membership.lastReadMessageId ?? null;
    await this.membershipModel
      .updateOne({ _id: membership._id }, { unreadCount: 0, lastReadMessageId })
      .exec();
    await this.events.emitAsync(ConversationEvent.Read, {
      conversationId: conversationId.toHexString(),
      userId: user.id,
      lastReadMessageId: lastReadMessageId?.toHexString() ?? null,
    } satisfies ConversationReadEvent);
  }

  async isMember(userId: string, conversationId: string): Promise<boolean> {
    return Boolean(await this.membershipModel.exists({ conversationId, userId }));
  }

  private async countMembers(conversationIds: Types.ObjectId[]): Promise<Map<string, number>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.membershipModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { conversationId: { $in: conversationIds } } },
      { $group: { _id: '$conversationId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [row._id.toHexString(), row.count]));
  }
}
