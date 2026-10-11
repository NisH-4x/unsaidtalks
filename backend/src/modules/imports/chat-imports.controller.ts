import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChatImportService, MAX_IMPORT_BYTES } from './chat-import.service';
import { ChatImportView, ImportPreviewView } from './chat-import.views';
import { ImportChatDto, ImportOptionsDto } from './dto/chat-import.dto';

const UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1, fields: 5, fieldSize: 128 * 1024 },
  defParamCharset: 'utf8',
};

function requireFile(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new BadRequestException('Choose the exported .txt file');
  return file;
}

@Controller('admin/groups/:groupId/imports')
@Roles('admin')
export class ChatImportsController {
  constructor(private readonly imports: ChatImportService) {}

  @Get()
  list(@Param('groupId', ParseObjectIdPipe) groupId: Types.ObjectId): Promise<ChatImportView[]> {
    return this.imports.list(groupId);
  }

  /** Reads the file and shows what would be imported, without storing anything. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  preview(
    @Param('groupId', ParseObjectIdPipe) groupId: Types.ObjectId,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() options: ImportOptionsDto,
  ): Promise<ImportPreviewView> {
    return this.imports.preview(groupId, requireFile(file), options);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  import(
    @CurrentUser() admin: AuthUser,
    @Param('groupId', ParseObjectIdPipe) groupId: Types.ObjectId,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ImportChatDto,
  ): Promise<ChatImportView> {
    return this.imports.import(admin, groupId, requireFile(file), dto);
  }
}
