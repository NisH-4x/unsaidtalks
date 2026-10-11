import { ConversationType, MessageType } from './conversation';
import { AdminUser } from './user';

export type ReportReason = 'spam' | 'abuse' | 'personal_info' | 'other';
export type ReportStatus = 'open' | 'dismissed' | 'actioned';
export type ReportDecision = 'dismiss' | 'remove-message';

/** All reports about one message, reviewed together by an admin. */
export interface ReportedMessage {
  messageId: string;
  status: ReportStatus;
  conversation: { id: string; type: ConversationType; title: string };
  message: {
    sender: AdminUser | null;
    senderName: string;
    type: MessageType;
    text: string;
    attachment: { name: string; mimeType: string; size: number } | null;
    sentAt: string;
    isDeleted: boolean;
  };
  reports: Array<{
    id: string;
    reason: ReportReason;
    note: string;
    reportedBy: AdminUser | null;
    createdAt: string;
  }>;
  reviewedBy: AdminUser | null;
  reviewedAt: string | null;
}
