import { ConversationType } from './conversation';
import { PublicUser } from './user';

export type NotificationType = 'reply' | 'announcement' | 'doubt_resolved';

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** `name` is the group's name; private chats have none. */
  conversation: { id: string; type: ConversationType; name: string | null };
  messageId: string;
  actor: PublicUser | null;
  preview: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  notifications: AppNotification[];
  hasMore: boolean;
  unreadCount: number;
}
