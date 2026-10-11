export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;
export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number];

export const UNSUPPORTED_FILE_MESSAGE =
  'Only images (JPEG, PNG, WebP, GIF) and PDF files can be shared';

const ascii = (content: Buffer, start: number, end: number) =>
  content.subarray(start, end).toString('latin1');

const SIGNATURES: Array<{ mimeType: AttachmentMimeType; matches: (content: Buffer) => boolean }> = [
  {
    mimeType: 'image/jpeg',
    matches: (c) => c[0] === 0xff && c[1] === 0xd8 && c[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    matches: (c) => c.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
  },
  {
    mimeType: 'image/gif',
    matches: (c) => ['GIF87a', 'GIF89a'].includes(ascii(c, 0, 6)),
  },
  {
    mimeType: 'image/webp',
    matches: (c) => ascii(c, 0, 4) === 'RIFF' && ascii(c, 8, 12) === 'WEBP',
  },
  {
    mimeType: 'application/pdf',
    matches: (c) => ascii(c, 0, 5) === '%PDF-',
  },
];

/**
 * Identifies a file by its first bytes. The type reported by the browser is ignored, so a
 * renamed HTML or SVG file can never be stored as an "image" and later served to others.
 */
export function detectAttachmentType(content: Buffer): AttachmentMimeType | null {
  return SIGNATURES.find(({ matches }) => matches(content))?.mimeType ?? null;
}

/** Images are shown inline; other files (PDFs) are offered as downloads. */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
