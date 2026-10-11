import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import { UsersModule } from '../users/users.module';
import { AdminReportsController } from './admin-reports.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Report, ReportSchema } from './schemas/report.schema';

@Module({
  imports: [
    AttachmentsModule,
    ConversationsModule,
    MessagesModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Report.name, schema: ReportSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService],
})
export class ModerationModule {}
