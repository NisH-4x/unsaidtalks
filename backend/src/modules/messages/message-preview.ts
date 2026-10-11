import { Message, MessageType } from './schemas/message.schema';

export const PREVIEW_MAX_LENGTH = 120;
export const DELETED_MESSAGE_PREVIEW = 'This message was deleted';

interface PreviewSource extends Pick<Message, 'text' | 'deletedAt'> {
  type: MessageType;
  attachment: { name: string } | null;
}

export function buildMessagePreview(message: PreviewSource): string {
  if (message.deletedAt) return DELETED_MESSAGE_PREVIEW;

  const text = message.text.trim().replace(/\s+/g, ' ');

  switch (message.type) {
    case 'image':
      return text ? truncate(text) : 'Photo';
    case 'file':
      return text ? truncate(text) : (message.attachment?.name ?? 'Document');
    default:
      return truncate(text);
  }
}

function truncate(text: string): string {
  return text.length > PREVIEW_MAX_LENGTH ? `${text.slice(0, PREVIEW_MAX_LENGTH - 1)}…` : text;
}
