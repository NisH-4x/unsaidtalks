import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { Report, ReportSchema } from '../moderation/schemas/report.schema';
import { UsersModule } from '../users/users.module';
import { AttachmentsController } from './attachments.controller';
import { GroupActivityListener } from './group-activity.listener';
import { MessageDeletionService } from './message-deletion.service';
import { MessageToolsController } from './message-tools.controller';
import { MessageToolsService } from './message-tools.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { Message, MessageSchema } from './schemas/message.schema';

@Module({
  imports: [
    AttachmentsModule,
    ConversationsModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Report.name, schema: ReportSchema },
    ]),
  ],
  controllers: [MessagesController, MessageToolsController, AttachmentsController],
  providers: [MessagesService, MessageToolsService, MessageDeletionService, GroupActivityListener],
  exports: [MessagesService, MessageDeletionService],
})
export class MessagesModule {}
