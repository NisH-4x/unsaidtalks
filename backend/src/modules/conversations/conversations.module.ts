import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { DirectChatsController } from './direct-chats.controller';
import { DirectChatsService } from './direct-chats.service';
import { GroupsService } from './groups.service';
import { Conversation, ConversationSchema } from './schemas/conversation.schema';
import { Membership, MembershipSchema } from './schemas/membership.schema';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
  ],
  controllers: [ConversationsController, DirectChatsController],
  providers: [ConversationsService, GroupsService, DirectChatsService],
  exports: [ConversationsService, GroupsService, DirectChatsService],
})
export class ConversationsModule {}
