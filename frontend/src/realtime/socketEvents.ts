/** Mirrors backend/src/modules/realtime/socket-events.ts. */
export const SocketEvent = {
  MessageSend: 'message:send',
  ConversationOpen: 'conversation:open',
  ConversationClose: 'conversation:close',
  PresenceSync: 'presence:sync',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  MessageNew: 'message:new',
  MessageUpdated: 'message:updated',
  ConversationRead: 'conversation:read',
  ConversationAdded: 'conversation:added',
  ConversationRemoved: 'conversation:removed',
  ConversationUnread: 'conversation:unread',
  ReceiptUpdated: 'receipt:updated',
  ConversationHistory: 'conversation:history',
  PresenceUpdate: 'presence:update',
  Typing: 'typing',
  NotificationNew: 'notification:new',
  NotificationsRead: 'notifications:read',
  NotificationsRemoved: 'notifications:removed',
} as const;

export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface PresenceUpdatePayload {
  userId: string;
  online: boolean;
  lastSeenAt?: string;
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
  name: string;
  isTyping: boolean;
}
