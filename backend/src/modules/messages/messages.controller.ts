import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MessageHistoryQueryDto, MessageSearchQueryDto } from './dto/message.dto';
import { MessagePage, MessagesService } from './messages.service';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  history(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Query() query: MessageHistoryQueryDto,
  ): Promise<MessagePage> {
    return this.messages.history(user, conversationId, query);
  }

  @Get('search')
  search(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
    @Query() query: MessageSearchQueryDto,
  ): Promise<MessagePage> {
    return this.messages.search(user, conversationId, query);
  }
}
