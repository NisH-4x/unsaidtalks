import { AttachmentMimeType } from './attachment-types';

const EXTENSIONS: Record<AttachmentMimeType, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf'],
};

const MAX_BASE_NAME_LENGTH = 100;
const RESERVED_CHARACTERS = '<>:"|?*';

const isAllowedCharacter = (char: string) => {
  const code = char.charCodeAt(0);
  return code >= 0x20 && code !== 0x7f && !RESERVED_CHARACTERS.includes(char);
};

/**
 * A file name that is safe to display and to save: no folders, control or reserved
 * characters, a bounded length, and an extension that matches the file's real type.
 */
export function cleanFileName(original: string, mimeType: AttachmentMimeType): string {
  const lastSegment = original.split(/[\\/]/).pop() ?? '';
  const cleaned = [...lastSegment].filter(isAllowedCharacter).join('').trim();

  const allowed = EXTENSIONS[mimeType];
  const dot = cleaned.lastIndexOf('.');
  const extension = dot >= 0 ? cleaned.slice(dot).toLowerCase() : '';
  const hasValidExtension = allowed.includes(extension);
  const base = (hasValidExtension ? cleaned.slice(0, dot) : cleaned).slice(0, MAX_BASE_NAME_LENGTH);

  return `${base.trim() || 'file'}${hasValidExtension ? extension : allowed[0]}`;
}

/** Header value with an ASCII fallback plus the exact UTF-8 name (RFC 6266 / RFC 5987). */
export function contentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
