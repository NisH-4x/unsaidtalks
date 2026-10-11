import { Message } from '../types/message';
import { api } from './client';

export interface AttachmentUpload {
  file: File;
  clientId: string;
  text: string;
  replyToId?: string;
  isAnnouncement?: boolean;
  isDoubt?: boolean;
  width?: number;
  height?: number;
}

export async function uploadAttachment(
  conversationId: string,
  { file, ...fields }: AttachmentUpload,
  onProgress: (fraction: number) => void,
): Promise<Message> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== '' && value !== false) form.append(key, String(value));
  }
  form.append('file', file);

  const { data } = await api.post<Message>(`/conversations/${conversationId}/attachments`, form, {
    onUploadProgress: ({ loaded, total }) => {
      if (total) onProgress(loaded / total);
    },
  });
  return data;
}

export const attachmentPath = (messageId: string) => `/messages/${messageId}/attachment`;

/** Loads a stored file with the access token; `download` asks for it as an attachment. */
export async function fetchFile(path: string, download = false): Promise<Blob> {
  const { data } = await api.get<Blob>(path, {
    responseType: 'blob',
    params: download ? { download: true } : undefined,
  });
  return data;
}
