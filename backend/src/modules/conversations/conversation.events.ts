/**
 * Announced by the conversations module after a group changes. Other modules react
 * without the conversations module depending on them: the messages module writes the
 * "X added Y" notes into the chat, and the real-time gateway moves sockets between rooms.
 */
export const GroupEvent = {
  Created: 'group.created',
  MembersAdded: 'group.members-added',
  MemberRemoved: 'group.member-removed',
} as const;

export interface PersonRef {
  id: string;
  name: string;
}

export interface GroupCreatedEvent {
  conversationId: string;
  actor: PersonRef;
}

export interface GroupMembersAddedEvent {
  conversationId: string;
  actor: PersonRef;
  members: PersonRef[];
}

export interface GroupMemberRemovedEvent {
  conversationId: string;
  actor: PersonRef;
  member: PersonRef;
}

export const ConversationEvent = {
  Read: 'conversation.read',
  DirectCreated: 'conversation.direct-created',
  UnreadChanged: 'conversation.unread-changed',
  HistoryImported: 'conversation.history-imported',
} as const;

/** Older messages were added to the conversation, so open copies of its history are stale. */
export interface HistoryImportedEvent {
  conversationId: string;
}

/** A member's unread count changed for a reason other than a new message or reading. */
export interface UnreadChangedEvent {
  conversationId: string;
  userId: string;
  unreadCount: number;
}

export interface ConversationReadEvent {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
}

export interface DirectChatCreatedEvent {
  conversationId: string;
  initiatorId: string;
  participantIds: [string, string];
}
