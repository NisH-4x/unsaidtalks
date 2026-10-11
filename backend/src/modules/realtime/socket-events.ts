/** Event names shared with the web client (frontend/src/realtime/socketEvents.ts). */
export const SocketEvent = {
  // Client to server
  MessageSend: 'message:send',
  ConversationOpen: 'conversation:open',
  ConversationClose: 'conversation:close',
  PresenceSync: 'presence:sync',
  TypingStart: 'typing:start',
  TypingStop: 'typing:stop',
  // Server to client
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

/** Every socket of one user (all their tabs and devices). */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** Every connected member of one conversation. */
export function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
