import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Throttle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DoubtSummaryService, DoubtSummaryView } from './doubt-summary.service';

// Each summary is a paid call to an external service.
const SUMMARIES_PER_MINUTE = { default: { limit: 6, ttl: 60_000 } };

@Controller('conversations/:conversationId/doubts/summary')
export class DoubtSummaryController {
  constructor(private readonly summaries: DoubtSummaryService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle(SUMMARIES_PER_MINUTE)
  summarise(
    @CurrentUser() user: AuthUser,
    @Param('conversationId', ParseObjectIdPipe) conversationId: Types.ObjectId,
  ): Promise<DoubtSummaryView> {
    return this.summaries.summarise(user, conversationId);
  }
}
