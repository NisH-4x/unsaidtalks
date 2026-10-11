import { ConversationType } from '../conversations/schemas/conversation.schema';
import { MessageType } from '../messages/schemas/message.schema';
import { AdminUserView } from '../users/user.views';
import { ReportReason, ReportStatus } from './schemas/report.schema';

/** All reports about one message, as the admin reviews them together. */
export interface ReportedMessageView {
  messageId: string;
  status: ReportStatus;
  conversation: { id: string; type: ConversationType; title: string };
  /** The message as it was when first reported, even if it has been deleted since. */
  message: {
    sender: AdminUserView | null;
    senderName: string;
    type: MessageType;
    text: string;
    attachment: { name: string; mimeType: string; size: number } | null;
    sentAt: Date;
    isDeleted: boolean;
  };
  reports: Array<{
    id: string;
    reason: ReportReason;
    note: string;
    reportedBy: AdminUserView | null;
    createdAt: Date;
  }>;
  reviewedBy: AdminUserView | null;
  reviewedAt: Date | null;
}
