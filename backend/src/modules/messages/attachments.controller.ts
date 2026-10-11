import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Types } from 'mongoose';
import { AttachmentStorage } from '../attachments/attachment-storage.service';
import { MAX_ATTACHMENT_BYTES } from '../attachments/attachment-types';
import { sendStoredFile } from '../attachments/send-stored-file';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AttachmentQueryDto, SendAttachmentDto } from './dto/message.dto';
import { MessageView } from './message.views';
import { MessagesService } from './messages.service';

const UPLOADS_PER_MINUTE = { default: { limit: 30, ttl: 60_000 } };

// Kept in memory (at most 5 MB) so the content can be checked before it is stored.
const UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1, fields: 10, fieldSize: 16 * 1024 },
  defParamCharset: 'utf8',
};

@Controller()
export class AttachmentsController {
  constructor(
    private readonly messages: MessagesService,
    private readonly storage: AttachmentStorage,
  ) {}

  @Post('conversations/:conversationId/attachments')
  @Throttle(UPLOADS_PER_MINUTE)
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  send(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: SendAttachmentDto,
  ): Promise<MessageView> {
    if (!file) throw new BadRequestException('Choose a file to send');
    return this.messages.sendAttachment(user, conversationId.toHexString(), file, body);
  }

  @Get('messages/:messageId/attachment')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Query() { download }: AttachmentQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const attachment = await this.messages.findAttachment(user, messageId);
    await sendStoredFile(response, this.storage, attachment, { download, ifNoneMatch });
  }
}
