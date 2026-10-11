import { Module } from '@nestjs/common';
import { AttachmentStorage } from './attachment-storage.service';

@Module({
  providers: [AttachmentStorage],
  exports: [AttachmentStorage],
})
export class AttachmentsModule {}
