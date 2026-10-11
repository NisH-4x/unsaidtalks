import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppConfigModule } from '../../config/app-config.module';
import { AttachmentsModule } from '../../modules/attachments/attachments.module';
import { RefreshToken, RefreshTokenSchema } from '../../modules/auth/schemas/refresh-token.schema';
import {
  Conversation,
  ConversationSchema,
} from '../../modules/conversations/schemas/conversation.schema';
import {
  Membership,
  MembershipSchema,
} from '../../modules/conversations/schemas/membership.schema';
import { Message, MessageSchema } from '../../modules/messages/schemas/message.schema';
import { Report, ReportSchema } from '../../modules/moderation/schemas/report.schema';
import {
  Notification,
  NotificationSchema,
} from '../../modules/notifications/schemas/notification.schema';
import { User, UserSchema } from '../../modules/users/schemas/user.schema';
import { DatabaseModule } from '../database.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    AppConfigModule,
    AttachmentsModule,
    DatabaseModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: Report.name, schema: ReportSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
  ],
  providers: [SeedService],
})
export class SeedModule {}
