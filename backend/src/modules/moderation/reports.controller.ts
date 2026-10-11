import { Body, Controller, Param, Post } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportMessageDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

const REPORTS_PER_MINUTE = { default: { limit: 10, ttl: 60_000 } };

@Controller('messages/:messageId/report')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @Throttle(REPORTS_PER_MINUTE)
  report(
    @CurrentUser() user: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Body() dto: ReportMessageDto,
  ): Promise<{ id: string }> {
    return this.reports.report(user, messageId, dto);
  }
}
