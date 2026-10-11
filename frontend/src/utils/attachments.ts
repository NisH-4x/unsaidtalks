import { Message } from '../types/message';

// Mirrors backend/src/modules/attachments/attachment-types.ts. The server checks the
// file's actual content; this only gives quick feedback before uploading.
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

export function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Why a file cannot be sent, or null if it looks fine. */
export function attachmentProblem(file: File): string | null {
  // Some systems report no type at all; the server decides from the content.
  if (file.type && !ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
    return 'Only images (JPEG, PNG, WebP, GIF) and PDF files can be shared.';
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return 'Files can be at most 5 MB.';
  if (file.size === 0) return 'This file is empty.';
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short text for a message in quotes, lists and previews: its text, or what it contains. */
export function messageSummary(message: Pick<Message, 'type' | 'text' | 'attachment'>): string {
  if (message.text) return message.text;
  if (message.type === 'image') return 'Photo';
  return message.attachment?.name ?? 'File';
}

const PREVIEW_MAX_LENGTH = 120;

/** One-line preview, as the server builds it for chat lists and quotes. */
export function messagePreview(message: Pick<Message, 'type' | 'text' | 'attachment'>): string {
  const summary = messageSummary(message).trim().replace(/\s+/g, ' ');
  return summary.length > PREVIEW_MAX_LENGTH
    ? `${summary.slice(0, PREVIEW_MAX_LENGTH - 1)}…`
    : summary;
}

export async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!isImageType(file.type)) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
