import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationsModule } from '../conversations/conversations.module';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import { UsersModule } from '../users/users.module';
import { DoubtSummaryController } from './doubt-summary.controller';
import { DoubtSummaryService } from './doubt-summary.service';
import { GroqClient } from './groq.client';

@Module({
  imports: [
    ConversationsModule,
    UsersModule,
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
  ],
  controllers: [DoubtSummaryController],
  providers: [DoubtSummaryService, GroqClient],
})
export class AiModule {}
