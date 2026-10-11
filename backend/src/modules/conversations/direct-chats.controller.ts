import { Body, Controller, Get, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DirectContact, DirectChatsService, OpenedDirectChat } from './direct-chats.service';
import { ContactsQueryDto, OpenDirectChatDto } from './dto/direct-chat.dto';

@Controller('direct-chats')
export class DirectChatsController {
  constructor(private readonly directChats: DirectChatsService) {}

  @Get('contacts')
  contacts(
    @CurrentUser() user: AuthUser,
    @Query() query: ContactsQueryDto,
  ): Promise<DirectContact[]> {
    return this.directChats.listContacts(user, query.q);
  }

  /** 201 when a new chat was created, 200 when the existing one is returned. */
  @Post()
  async open(
    @CurrentUser() user: AuthUser,
    @Body() dto: OpenDirectChatDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OpenedDirectChat> {
    const result = await this.directChats.open(user, new Types.ObjectId(dto.userId));
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }
}
