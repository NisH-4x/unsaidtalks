import { Body, Controller, Get, Headers, Param, Patch, Query, Res } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Response } from 'express';
import { Types } from 'mongoose';
import { AttachmentStorage } from '../attachments/attachment-storage.service';
import { sendStoredFile } from '../attachments/send-stored-file';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AttachmentQueryDto } from '../messages/dto/message.dto';
import { ReportDecisionDto, ReportsQueryDto } from './dto/report.dto';
import { ReportedMessageView } from './report.views';
import { ReportsService } from './reports.service';

@Controller('admin/reports')
@Roles('admin')
export class AdminReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly storage: AttachmentStorage,
  ) {}

  @Get()
  list(@Query() { status }: ReportsQueryDto): Promise<ReportedMessageView[]> {
    return this.reports.listForAdmin(status);
  }

  @Get('open-count')
  async openCount(): Promise<{ count: number }> {
    return { count: await this.reports.countOpen() };
  }

  @Patch(':messageId')
  decide(
    @CurrentUser() admin: AuthUser,
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Body() { decision }: ReportDecisionDto,
  ): Promise<ReportedMessageView> {
    return this.reports.decide(admin, messageId, decision);
  }

  @Get(':messageId/attachment')
  async attachment(
    @Param('messageId', ParseObjectIdPipe) messageId: Types.ObjectId,
    @Query() { download }: AttachmentQueryDto,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const attachment = await this.reports.reportedAttachment(messageId);
    await sendStoredFile(response, this.storage, attachment, { download, ifNoneMatch });
  }
}
