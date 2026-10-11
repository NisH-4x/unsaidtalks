import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConversationEvent, ConversationReadEvent } from '../conversations/conversation.events';
import { MessageCreatedEvent, MessageEvent, MessageUpdatedEvent } from '../messages/message.events';
import { NotificationsService } from './notifications.service';

// The listeners run asynchronously, after the message has been delivered, so creating
// notifications never slows down sending; failures are logged by the event emitter.
@Injectable()
export class NotificationsListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(MessageEvent.Created, { async: true })
  onMessageCreated({ message, preview }: MessageCreatedEvent): Promise<void> {
    return this.notifications.notifyForNewMessage(message, preview);
  }

  @OnEvent(MessageEvent.Updated, { async: true })
  async onMessageUpdated({ message, change, actorId }: MessageUpdatedEvent): Promise<void> {
    if (change === 'doubt-resolved') await this.notifications.notifyDoubtResolved(message, actorId);
    if (change === 'deleted') await this.notifications.removeForMessage(message.id);
    if (change === 'edited') await this.notifications.refreshPreview(message);
  }

  @OnEvent(ConversationEvent.Read, { async: true })
  onConversationRead({ conversationId, userId }: ConversationReadEvent): Promise<void> {
    return this.notifications.markConversationRead(userId, conversationId);
  }
}
