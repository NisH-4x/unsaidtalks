import { describe, expect, it } from 'vitest';
import { ChatMessage } from '../types/message';
import { canEditMessage, EDIT_WINDOW_MS } from './permissions';

const sentAt = Date.parse('2026-10-10T10:00:00.000Z');

function message(changes: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'a1',
    conversationId: 'c1',
    type: 'text',
    text: 'Hello',
    sender: { id: 'u-rahul', name: 'Rahul Verma', role: 'mentee' },
    attachment: null,
    replyTo: null,
    isAnnouncement: false,
    pin: null,
    doubt: null,
    reactions: [],
    editedAt: null,
    importedFrom: null,
    isDeleted: false,
    removedByModerator: false,
    createdAt: new Date(sentAt).toISOString(),
    ...changes,
  };
}

describe('canEditMessage', () => {
  it('allows the sender to edit for five minutes', () => {
    expect(canEditMessage(message(), true, sentAt + EDIT_WINDOW_MS - 1)).toBe(true);
    expect(canEditMessage(message(), true, sentAt + EDIT_WINDOW_MS)).toBe(false);
  });

  it('never allows editing other people’s, deleted, unsent or system messages', () => {
    const now = sentAt + 1000;
    expect(canEditMessage(message(), false, now)).toBe(false);
    expect(canEditMessage(message({ isDeleted: true }), true, now)).toBe(false);
    expect(canEditMessage(message({ delivery: 'sending' }), true, now)).toBe(false);
    expect(canEditMessage(message({ type: 'system' }), true, now)).toBe(false);
  });
});
