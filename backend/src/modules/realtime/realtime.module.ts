import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { ChatGateway } from './chat.gateway';
import { PresenceService } from './presence.service';
import { RealtimeEventsListener } from './realtime-events.listener';

@Module({
  imports: [AuthModule, UsersModule, ConversationsModule, MessagesModule],
  providers: [ChatGateway, PresenceService, RealtimeEventsListener],
})
export class RealtimeModule {}
