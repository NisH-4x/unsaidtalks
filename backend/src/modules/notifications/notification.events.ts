import { NotificationView } from './notification.views';

export const NotificationEvent = {
  Created: 'notification.created',
  Read: 'notification.read',
  Removed: 'notification.removed',
} as const;

export interface NotificationCreatedEvent {
  userId: string;
  notification: NotificationView;
  unreadCount: number;
}

/** Some of a user's notifications were read: the listed ones, one conversation's, or all. */
export interface NotificationsReadEvent {
  userId: string;
  unreadCount: number;
  ids?: string[];
  conversationId?: string;
}

/** Notifications about a message that has since been deleted. */
export interface NotificationsRemovedEvent {
  userId: string;
  ids: string[];
  unreadCount: number;
}
