import { Types } from 'mongoose';
import { PublicUserView } from '../users/user.views';
import { DoubtStatus, Message, MessageType, REACTION_EMOJIS } from './schemas/message.schema';

type StoredMessage = Message & { _id: Types.ObjectId };

export interface MessageView {
  id: string;
  conversationId: string;
  type: MessageType;
  text: string;
  sender: PublicUserView | null;
  attachment: {
    name: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
  } | null;
  replyTo: {
    messageId: string;
    senderName: string;
    type: MessageType;
    preview: string;
    isDeleted: boolean;
  } | null;
  isAnnouncement: boolean;
  pin: { pinnedBy: string; pinnedAt: Date } | null;
  doubt: { status: DoubtStatus; resolvedBy: string | null; resolvedAt: Date | null } | null;
  /** Grouped by emoji, in the fixed order of the reaction picker. */
  reactions: Array<{ emoji: string; userIds: string[] }>;
  editedAt: Date | null;
  /** Set for history imported from a WhatsApp export. */
  importedFrom: { source: 'whatsapp'; senderName: string } | null;
  isDeleted: boolean;
  /** Deleted by a mentor or admin rather than by the sender. */
  removedByModerator: boolean;
  createdAt: Date;
}

/** Deleted messages keep their place in the timeline but expose none of their content. */
export function toMessageView(message: StoredMessage, sender: PublicUserView | null): MessageView {
  const isDeleted = message.deletedAt !== null;
  const { attachment, replyTo, pin, doubt } = message;

  return {
    id: message._id.toHexString(),
    conversationId: message.conversationId.toHexString(),
    type: message.type,
    text: isDeleted ? '' : message.text,
    sender,
    attachment:
      attachment && !isDeleted
        ? {
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            width: attachment.width ?? null,
            height: attachment.height ?? null,
          }
        : null,
    replyTo:
      replyTo && !isDeleted
        ? {
            messageId: replyTo.messageId.toHexString(),
            senderName: replyTo.senderName,
            type: replyTo.type,
            preview: replyTo.isDeleted ? '' : replyTo.preview,
            isDeleted: replyTo.isDeleted,
          }
        : null,
    isAnnouncement: message.isAnnouncement,
    pin: pin ? { pinnedBy: pin.pinnedBy.toHexString(), pinnedAt: pin.pinnedAt } : null,
    doubt: doubt
      ? {
          status: doubt.status,
          resolvedBy: doubt.resolvedBy?.toHexString() ?? null,
          resolvedAt: doubt.resolvedAt,
        }
      : null,
    reactions: isDeleted ? [] : groupReactions(message.reactions ?? []),
    editedAt: isDeleted ? null : (message.editedAt ?? null),
    importedFrom: message.import
      ? { source: message.import.source, senderName: message.import.senderName }
      : null,
    isDeleted,
    removedByModerator:
      isDeleted && Boolean(message.deletedBy && !message.deletedBy.equals(message.senderId)),
    createdAt: message.createdAt,
  };
}

function groupReactions(reactions: Message['reactions']): MessageView['reactions'] {
  return REACTION_EMOJIS.map((emoji) => ({
    emoji,
    userIds: reactions.filter((r) => r.emoji === emoji).map((r) => r.userId.toHexString()),
  })).filter((group) => group.userIds.length > 0);
}
