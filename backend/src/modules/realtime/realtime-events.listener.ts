import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConversationEvent,
  ConversationReadEvent,
  DirectChatCreatedEvent,
  GroupEvent,
  GroupMemberRemovedEvent,
  GroupMembersAddedEvent,
  HistoryImportedEvent,
  UnreadChangedEvent,
} from '../conversations/conversation.events';
import { MessageCreatedEvent, MessageEvent, MessageUpdatedEvent } from '../messages/message.events';
import {
  NotificationCreatedEvent,
  NotificationEvent,
  NotificationsReadEvent,
  NotificationsRemovedEvent,
} from '../notifications/notification.events';
import { UserDeactivatedEvent, UserEvent } from '../users/user.events';
import { ChatGateway } from './chat.gateway';
import { conversationRoom, SocketEvent, userRoom } from './socket-events';

/** Turns things that happened in the domain into socket updates for the right rooms. */
@Injectable()
export class RealtimeEventsListener {
  constructor(private readonly gateway: ChatGateway) {}

  private get server() {
    return this.gateway.server;
  }

  @OnEvent(MessageEvent.Created)
  onMessageCreated({ message, preview, clientId }: MessageCreatedEvent): void {
    this.server
      .to(conversationRoom(message.conversationId))
      .emit(SocketEvent.MessageNew, { message, preview, clientId });
  }

  @OnEvent(MessageEvent.Updated)
  onMessageUpdated({ message }: MessageUpdatedEvent): void {
    this.server
      .to(conversationRoom(message.conversationId))
      .emit(SocketEvent.MessageUpdated, { message });
  }

  /**
   * Keeps the unread badge in step across all of the reader's tabs and devices, and tells
   * the other members how far they have read (read receipts).
   */
  @OnEvent(ConversationEvent.Read)
  onConversationRead({ conversationId, userId, lastReadMessageId }: ConversationReadEvent): void {
    this.server.to(userRoom(userId)).emit(SocketEvent.ConversationRead, { conversationId });
    this.server
      .to(conversationRoom(conversationId))
      .emit(SocketEvent.ReceiptUpdated, { conversationId, userId, lastReadMessageId });
  }

  @OnEvent(ConversationEvent.UnreadChanged)
  onUnreadChanged({ conversationId, userId, unreadCount }: UnreadChangedEvent): void {
    this.server
      .to(userRoom(userId))
      .emit(SocketEvent.ConversationUnread, { conversationId, unreadCount });
  }

  @OnEvent(ConversationEvent.HistoryImported)
  onHistoryImported({ conversationId }: HistoryImportedEvent): void {
    this.server.to(conversationRoom(conversationId)).emit(SocketEvent.ConversationHistory, {
      conversationId,
    });
  }

  @OnEvent(NotificationEvent.Created)
  onNotificationCreated({ userId, notification, unreadCount }: NotificationCreatedEvent): void {
    this.server
      .to(userRoom(userId))
      .emit(SocketEvent.NotificationNew, { notification, unreadCount });
  }

  @OnEvent(NotificationEvent.Read)
  onNotificationsRead({ userId, ...read }: NotificationsReadEvent): void {
    this.server.to(userRoom(userId)).emit(SocketEvent.NotificationsRead, read);
  }

  @OnEvent(NotificationEvent.Removed)
  onNotificationsRemoved({ userId, ids, unreadCount }: NotificationsRemovedEvent): void {
    this.server.to(userRoom(userId)).emit(SocketEvent.NotificationsRemoved, { ids, unreadCount });
  }

  @OnEvent(GroupEvent.MembersAdded)
  onMembersAdded({ conversationId, members }: GroupMembersAddedEvent): void {
    for (const member of members) {
      this.server.in(userRoom(member.id)).socketsJoin(conversationRoom(conversationId));
      this.server.to(userRoom(member.id)).emit(SocketEvent.ConversationAdded, { conversationId });
    }
  }

  /**
   * Both people's open sockets join the new chat's room at once, so the first message
   * reaches the recipient live; the creator's other tabs refresh their chat list.
   */
  @OnEvent(ConversationEvent.DirectCreated)
  onDirectChatCreated({ conversationId, initiatorId, participantIds }: DirectChatCreatedEvent) {
    const room = conversationRoom(conversationId);
    this.server.in(participantIds.map(userRoom)).socketsJoin(room);
    this.server.to(userRoom(initiatorId)).emit(SocketEvent.ConversationAdded, { conversationId });
  }

  @OnEvent(GroupEvent.MemberRemoved)
  onMemberRemoved({ conversationId, member }: GroupMemberRemovedEvent): void {
    this.server.in(userRoom(member.id)).socketsLeave(conversationRoom(conversationId));
    this.server.to(userRoom(member.id)).emit(SocketEvent.ConversationRemoved, { conversationId });
  }

  @OnEvent(UserEvent.Deactivated)
  onUserDeactivated({ userId }: UserDeactivatedEvent): void {
    this.server.in(userRoom(userId)).disconnectSockets(true);
  }
}
