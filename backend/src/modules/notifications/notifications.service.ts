import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { ConversationsService } from '../conversations/conversations.service';
import { buildMessagePreview } from '../messages/message-preview';
import { MessageView } from '../messages/message.views';
import { Message } from '../messages/schemas/message.schema';
import { toPublicUserView } from '../users/user.views';
import { UsersService } from '../users/users.service';
import {
  NotificationCreatedEvent,
  NotificationEvent,
  NotificationsReadEvent,
  NotificationsRemovedEvent,
} from './notification.events';
import { NotificationPage, NotificationView } from './notification.views';
import { Notification, NotificationType } from './schemas/notification.schema';

type StoredNotification = Notification & { _id: Types.ObjectId };

interface NewNotification {
  type: NotificationType;
  conversationId: string;
  messageId: string;
  actorId: string;
  preview: string;
}

const PAGE_SIZE = 20;

/** In-app notifications for replies, announcements and resolved doubts. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<Notification>,
    @InjectModel(Message.name) private readonly messageModel: Model<Message>,
    private readonly conversations: ConversationsService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async list(user: AuthUser, before?: string): Promise<NotificationPage> {
    const filter: FilterQuery<Notification> = { userId: user.id };
    if (before) filter._id = { $lt: new Types.ObjectId(before) };

    const rows = await this.notificationModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(PAGE_SIZE + 1)
      .lean();
    return {
      notifications: await this.present(rows.slice(0, PAGE_SIZE)),
      hasMore: rows.length > PAGE_SIZE,
      unreadCount: await this.unreadCount(user.id),
    };
  }

  /** Marks the given notifications (or all of them) as read, in every tab of the user. */
  async markRead(user: AuthUser, ids?: string[]): Promise<{ unreadCount: number }> {
    const filter: FilterQuery<Notification> = { userId: user.id, readAt: null };
    if (ids) filter._id = { $in: ids };
    await this.notificationModel.updateMany(filter, { readAt: new Date() }).exec();

    const unreadCount = await this.unreadCount(user.id);
    await this.events.emitAsync(NotificationEvent.Read, {
      userId: user.id,
      unreadCount,
      ids,
    } satisfies NotificationsReadEvent);
    return { unreadCount };
  }

  /** Opening a conversation counts as seeing the notifications that point into it. */
  async markConversationRead(userId: string, conversationId: string): Promise<void> {
    const { modifiedCount } = await this.notificationModel
      .updateMany({ userId, conversationId, readAt: null }, { readAt: new Date() })
      .exec();
    if (modifiedCount === 0) return;

    await this.events.emitAsync(NotificationEvent.Read, {
      userId,
      conversationId,
      unreadCount: await this.unreadCount(userId),
    } satisfies NotificationsReadEvent);
  }

  /** The author of a replied-to message hears about the reply; members hear about announcements. */
  async notifyForNewMessage(message: MessageView, preview: string): Promise<void> {
    if (!message.sender) return;
    const base = {
      conversationId: message.conversationId,
      messageId: message.id,
      actorId: message.sender.id,
      preview,
    };

    const replyRecipient = message.replyTo && (await this.repliedAuthor(message));
    if (replyRecipient) await this.notify([replyRecipient], { ...base, type: 'reply' });

    if (message.isAnnouncement) {
      const members = await this.conversations.listMemberIds(message.conversationId);
      const recipients = members.filter((id) => id !== base.actorId && id !== replyRecipient);
      await this.notify(recipients, { ...base, type: 'announcement' });
    }
  }

  async notifyDoubtResolved(doubt: MessageView, resolverId: string): Promise<void> {
    const askerId = doubt.sender?.id;
    if (!askerId || askerId === resolverId) return;
    if (!(await this.conversations.isMember(askerId, doubt.conversationId))) return;
    // Reopening and resolving again does not notify the asker a second time.
    const pending = await this.notificationModel.exists({
      userId: askerId,
      type: 'doubt_resolved',
      messageId: doubt.id,
      readAt: null,
    });
    if (pending) return;

    await this.notify([askerId], {
      type: 'doubt_resolved',
      conversationId: doubt.conversationId,
      messageId: doubt.id,
      actorId: resolverId,
      preview: buildMessagePreview({ ...doubt, deletedAt: null }),
    });
  }

  /** A deleted message takes its notifications with it, so its text is not kept there. */
  async removeForMessage(messageId: string): Promise<void> {
    const doomed = await this.notificationModel.find({ messageId }, { userId: 1 }).lean();
    if (doomed.length === 0) return;
    await this.notificationModel.deleteMany({ _id: { $in: doomed.map((n) => n._id) } }).exec();

    const idsByUser = new Map<string, string[]>();
    for (const { _id, userId } of doomed) {
      const key = userId.toHexString();
      idsByUser.set(key, [...(idsByUser.get(key) ?? []), _id.toHexString()]);
    }
    for (const [userId, ids] of idsByUser) {
      await this.events.emitAsync(NotificationEvent.Removed, {
        userId,
        ids,
        unreadCount: await this.unreadCount(userId),
      } satisfies NotificationsRemovedEvent);
    }
  }

  /** Notifications quote the message, so they follow an edit. */
  async refreshPreview(message: MessageView): Promise<void> {
    await this.notificationModel
      .updateMany(
        { messageId: message.id },
        { preview: buildMessagePreview({ ...message, deletedAt: null }) },
      )
      .exec();
  }

  private async repliedAuthor(reply: MessageView): Promise<string | null> {
    const original = reply.replyTo
      ? await this.messageModel.findById(reply.replyTo.messageId, { senderId: 1 }).lean()
      : null;
    const authorId = original?.senderId?.toHexString();
    if (!authorId || authorId === reply.sender?.id) return null;
    return (await this.conversations.isMember(authorId, reply.conversationId)) ? authorId : null;
  }

  private async notify(userIds: string[], notification: NewNotification): Promise<void> {
    if (userIds.length === 0) return;
    const created = await this.notificationModel.insertMany(
      userIds.map((userId) => ({ ...notification, userId })),
    );
    const views = await this.present(created.map((doc) => doc.toObject()));

    await Promise.all(
      views.map(async (view, index) => {
        const userId = userIds[index];
        await this.events.emitAsync(NotificationEvent.Created, {
          userId,
          notification: view,
          unreadCount: await this.unreadCount(userId),
        } satisfies NotificationCreatedEvent);
      }),
    );
  }

  private unreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ userId, readAt: null }).exec();
  }

  private async present(rows: StoredNotification[]): Promise<NotificationView[]> {
    const actors = new Map(
      (await this.users.findByIds(rows.map((n) => n.actorId))).map((u) => [
        u._id.toHexString(),
        toPublicUserView(u),
      ]),
    );
    const conversations = new Map(
      (await this.conversations.findSummaries(rows.map((n) => n.conversationId))).map((c) => [
        c._id.toHexString(),
        c,
      ]),
    );

    return rows.map((row) => {
      const conversationId = row.conversationId.toHexString();
      const conversation = conversations.get(conversationId);
      return {
        id: row._id.toHexString(),
        type: row.type,
        conversation: {
          id: conversationId,
          type: conversation?.type ?? 'group',
          name: conversation?.type === 'group' ? (conversation.name ?? null) : null,
        },
        messageId: row.messageId.toHexString(),
        actor: actors.get(row.actorId.toHexString()) ?? null,
        preview: row.preview,
        readAt: row.readAt,
        createdAt: row.createdAt,
      };
    });
  }
}
