import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import { UsersModule } from '../users/users.module';
import { ChatImportService } from './chat-import.service';
import { ChatImportsController } from './chat-imports.controller';
import { ChatImport, ChatImportSchema } from './schemas/chat-import.schema';

@Module({
  imports: [
    ConversationsModule,
    MessagesModule,
    UsersModule,
    MongooseModule.forFeature([
      { name: ChatImport.name, schema: ChatImportSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  controllers: [ChatImportsController],
  providers: [ChatImportService],
})
export class ImportsModule {}
