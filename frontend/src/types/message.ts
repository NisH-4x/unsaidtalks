import { MessageType } from './conversation';
import { PublicUser } from './user';

export interface Attachment {
  name: string;
  mimeType: string;
  size: number;
  /** Pixel size, when known, so the image's space can be reserved while it loads. */
  width: number | null;
  height: number | null;
}

export interface Message {
  id: string;
  conversationId: string;
  type: MessageType;
  text: string;
  sender: PublicUser | null;
  attachment: Attachment | null;
  replyTo: {
    messageId: string;
    senderName: string;
    type: MessageType;
    preview: string;
    isDeleted: boolean;
  } | null;
  isAnnouncement: boolean;
  pin: { pinnedBy: string; pinnedAt: string } | null;
  doubt: {
    status: 'open' | 'resolved';
    resolvedBy: string | null;
    resolvedAt: string | null;
  } | null;
  /** Grouped by emoji, in the order of the reaction picker. */
  reactions: Array<{ emoji: string; userIds: string[] }>;
  editedAt: string | null;
  /** Set for history imported from a WhatsApp export; the sender may have no account. */
  importedFrom: { source: 'whatsapp'; senderName: string } | null;
  isDeleted: boolean;
  /** Deleted by a mentor or admin rather than by the sender. */
  removedByModerator: boolean;
  createdAt: string;
}

export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
}

/** A message as shown on screen: either stored on the server, or a draft still being sent. */
export interface ChatMessage extends Message {
  clientId?: string;
  delivery?: 'sending' | 'failed';
  failureReason?: string;
  /** A file this tab is uploading, kept so a failed upload can be retried. */
  upload?: { file: File; progress: number };
  /** The sender's own copy of an image, shown instead of downloading it again. */
  localUrl?: string;
}

export interface MessageCreatedPayload {
  message: Message;
  preview: string;
  clientId?: string;
}
