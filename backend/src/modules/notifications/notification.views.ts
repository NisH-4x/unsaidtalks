import { ConversationType } from '../conversations/schemas/conversation.schema';
import { PublicUserView } from '../users/user.views';
import { NotificationType } from './schemas/notification.schema';

export interface NotificationView {
  id: string;
  type: NotificationType;
  /** `name` is the group's name; private chats have none. */
  conversation: { id: string; type: ConversationType; name: string | null };
  messageId: string;
  actor: PublicUserView | null;
  preview: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationPage {
  notifications: NotificationView[];
  hasMore: boolean;
  unreadCount: number;
}
