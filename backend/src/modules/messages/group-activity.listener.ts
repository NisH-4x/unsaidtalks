import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  GroupCreatedEvent,
  GroupEvent,
  GroupMemberRemovedEvent,
  GroupMembersAddedEvent,
} from '../conversations/conversation.events';
import { MessagesService } from './messages.service';
import { describeMembersAdded } from './system-message-text';

/** Writes group membership changes into the chat timeline as system notes. */
@Injectable()
export class GroupActivityListener {
  constructor(private readonly messages: MessagesService) {}

  @OnEvent(GroupEvent.Created)
  async onGroupCreated({ conversationId, actor }: GroupCreatedEvent): Promise<void> {
    await this.messages.createSystemMessage(
      conversationId,
      actor,
      `${actor.name} created this group`,
    );
  }

  @OnEvent(GroupEvent.MembersAdded)
  async onMembersAdded({ conversationId, actor, members }: GroupMembersAddedEvent): Promise<void> {
    const text = describeMembersAdded(
      actor.name,
      members.map((member) => member.name),
    );
    await this.messages.createSystemMessage(conversationId, actor, text);
  }

  @OnEvent(GroupEvent.MemberRemoved)
  async onMemberRemoved({ conversationId, actor, member }: GroupMemberRemovedEvent): Promise<void> {
    await this.messages.createSystemMessage(
      conversationId,
      actor,
      `${actor.name} removed ${member.name}`,
    );
  }
}
