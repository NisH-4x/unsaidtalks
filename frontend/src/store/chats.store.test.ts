import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listConversations } from '../api/conversations.api';
import { ChatListItem } from '../types/conversation';
import { Message } from '../types/message';
import { useChatsStore } from './chats.store';

vi.mock('../api/conversations.api', () => ({ listConversations: vi.fn() }));
vi.mock('../api/messages.api', () => ({ markConversationRead: vi.fn() }));

const arjun = { id: 'u-arjun', name: 'Arjun Mehta', role: 'mentor' as const };

const group: ChatListItem = {
  id: 'c1',
  type: 'group',
  title: 'TCS NQT Prep – Batch 12',
  lastMessage: null,
  lastActivityAt: '2026-10-10T09:00:00.000Z',
  unreadCount: 0,
};

function message(id: string, text: string): Message {
  return {
    id,
    conversationId: 'c1',
    type: 'text',
    text,
    sender: arjun,
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
    createdAt: '2026-10-10T10:00:00.000Z',
  };
}

const chat = () => useChatsStore.getState().conversations[0];

beforeEach(async () => {
  useChatsStore.getState().reset();
  vi.mocked(listConversations).mockResolvedValueOnce([group]);
  await useChatsStore.getState().load('u-aman');
});

describe('chats store', () => {
  it('keeps the later message as the preview when messages arrive out of order', () => {
    const { applyIncomingMessage } = useChatsStore.getState();
    applyIncomingMessage(
      {
        message: message('a2', 'Revise two-pointer problems'),
        preview: 'Revise two-pointer problems',
      },
      'u-aman',
    );
    applyIncomingMessage(
      { message: message('a1', 'Coding round tomorrow'), preview: 'Coding round tomorrow' },
      'u-aman',
    );

    expect(chat().lastMessage?.preview).toBe('Revise two-pointer problems');
    expect(chat().unreadCount).toBe(2);
  });

  it('replaces the preview of a deleted last message', () => {
    useChatsStore
      .getState()
      .applyIncomingMessage(
        { message: message('a1', 'My number is…'), preview: 'My number is…' },
        'u-aman',
      );

    useChatsStore.getState().applyDeletedMessage({ ...message('a1', ''), isDeleted: true });

    expect(chat().lastMessage).toMatchObject({ preview: 'This message was deleted', type: 'text' });
  });
});
