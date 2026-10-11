import { NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { Types } from 'mongoose';
import { pipeline } from 'stream/promises';
import { contentDisposition } from './attachment-name';
import { AttachmentStorage } from './attachment-storage.service';
import { isImage } from './attachment-types';

interface StoredFileRef {
  fileId: Types.ObjectId;
  name: string;
  mimeType: string;
}

/**
 * Streams a stored file after the caller has checked access. Images may be shown inline;
 * anything else is always a download, and the verified type is sent with `nosniff`.
 */
export async function sendStoredFile(
  response: Response,
  storage: AttachmentStorage,
  file: StoredFileRef,
  { download, ifNoneMatch }: { download?: boolean; ifNoneMatch?: string },
): Promise<void> {
  // Stored files never change, so the browser may reuse its copy, but only after the
  // request has passed the caller's access check.
  const etag = `"${file.fileId.toHexString()}"`;
  response.set({ ETag: etag, 'Cache-Control': 'private, no-cache' });
  if (ifNoneMatch === etag) {
    response.status(304).end();
    return;
  }

  const size = await storage.sizeOf(file.fileId);
  if (size === null) throw new NotFoundException('Attachment not found');

  const inline = isImage(file.mimeType) && !download;
  response.set({
    'Content-Type': file.mimeType,
    'Content-Length': String(size),
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', file.name),
  });
  try {
    await pipeline(storage.open(file.fileId), response);
  } catch {
    // The reader went away or the stream failed part-way; the response cannot be repaired.
    response.destroy();
  }
}
