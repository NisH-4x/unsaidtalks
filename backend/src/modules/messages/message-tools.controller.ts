import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DoubtsQueryDto, DoubtStatusDto, EditMessageDto } from './dto/message.dto';
import { MessageDeletionService } from './message-deletion.service';
import { MessageToolsService } from './message-tools.service';
import { MessagesService } from './messages.service';
import { MessageView } from './message.views';

/** Actions on a single message (edit, react, pin, doubt, delete) and the lists behind the group info tabs. */
@Controller()
export class MessageToolsController {
  constructor(
    private readonly tools: MessageToolsService,
    private readonly deletion: MessageDeletionService,
    private readonly messages: MessagesService,
  ) {}

  @Patch('messages/:messageId')
  edit(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Body() dto: EditMessageDto,
  ): Promise<MessageView> {
    return this.messages.edit(user, messageId, dto);
  }

  @Put('messages/:messageId/reactions/:emoji')
  react(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Param('emoji') emoji: string,
  ): Promise<MessageView> {
    return this.tools.react(user, messageId, emoji);
  }

  @Delete('messages/:messageId/reactions/:emoji')
  unreact(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Param('emoji') emoji: string,
  ): Promise<MessageView> {
    return this.tools.unreact(user, messageId, emoji);
  }

  @Delete('messages/:messageId')
  delete(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
  ): Promise<MessageView> {
    return this.deletion.delete(user, messageId);
  }

  @Get('conversations/:conversationId/pins')
  pins(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
  ): Promise<MessageView[]> {
    return this.tools.listPins(user, conversationId);
  }

  @Get('conversations/:conversationId/doubts')
  doubts(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Query() query: DoubtsQueryDto,
  ): Promise<MessageView[]> {
    return this.tools.listDoubts(user, conversationId, query.status);
  }

  @Get('conversations/:conversationId/announcements')
  announcements(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
  ): Promise<MessageView[]> {
    return this.tools.listAnnouncements(user, conversationId);
  }

  @Post('messages/:messageId/pin')
  @HttpCode(HttpStatus.OK)
  pin(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
  ): Promise<MessageView> {
    return this.tools.pin(user, messageId);
  }

  @Delete('messages/:messageId/pin')
  unpin(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
  ): Promise<MessageView> {
    return this.tools.unpin(user, messageId);
  }

  @Post('messages/:messageId/doubt')
  @HttpCode(HttpStatus.OK)
  markDoubt(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
  ): Promise<MessageView> {
    return this.tools.markDoubt(user, messageId);
  }

  @Delete('messages/:messageId/doubt')
  unmarkDoubt(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
  ): Promise<MessageView> {
    return this.tools.unmarkDoubt(user, messageId);
  }

  @Patch('messages/:messageId/doubt')
  setDoubtStatus(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Body() dto: DoubtStatusDto,
  ): Promise<MessageView> {
    return this.tools.setDoubtStatus(user, messageId, dto.status);
  }
}
