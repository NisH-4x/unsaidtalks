import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MarkNotificationsReadDto, NotificationsQueryDto } from './dto/notification.dto';
import { NotificationPage } from './notification.views';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() { before }: NotificationsQueryDto,
  ): Promise<NotificationPage> {
    return this.notifications.list(user, before);
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUser() user: AuthUser,
    @Body() { ids }: MarkNotificationsReadDto,
  ): Promise<{ unreadCount: number }> {
    return this.notifications.markRead(user, ids);
  }
}
