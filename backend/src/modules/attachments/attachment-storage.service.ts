import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, mongo, Types } from 'mongoose';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

export const ATTACHMENTS_BUCKET = 'attachments';

export interface StoredFileMetadata {
  mimeType: string;
  conversationId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
}

/** Keeps uploaded files in MongoDB GridFS, next to the messages that reference them. */
@Injectable()
export class AttachmentStorage {
  private gridFs?: mongo.GridFSBucket;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async save(
    content: Buffer,
    fileName: string,
    metadata: StoredFileMetadata,
  ): Promise<Types.ObjectId> {
    const upload = this.bucket().openUploadStream(fileName, { metadata });
    upload.end(content);
    await finished(upload);
    return upload.id;
  }

  /** The stored size in bytes, or null if the file does not exist. */
  async sizeOf(fileId: Types.ObjectId): Promise<number | null> {
    const file = await this.bucket().find({ _id: fileId }).next();
    return file?.length ?? null;
  }

  open(fileId: Types.ObjectId): Readable {
    return this.bucket().openDownloadStream(fileId);
  }

  async remove(fileId: Types.ObjectId): Promise<void> {
    await this.bucket().delete(fileId);
  }

  // Created on first use: the database handle only exists once the connection is open.
  private bucket(): mongo.GridFSBucket {
    if (!this.gridFs) {
      const db = this.connection.db;
      if (!db) throw new Error('The database connection is not open');
      this.gridFs = new mongo.GridFSBucket(db, { bucketName: ATTACHMENTS_BUCKET });
    }
    return this.gridFs;
  }
}
