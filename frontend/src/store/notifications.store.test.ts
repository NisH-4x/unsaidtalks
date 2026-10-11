import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchNotifications, markNotificationsRead } from '../api/notifications.api';
import { AppNotification } from '../types/notification';
import { useNotificationsStore } from './notifications.store';

vi.mock('../api/notifications.api', () => ({
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));

function notification(id: string, conversationId = 'c1'): AppNotification {
  return {
    id,
    type: 'announcement',
    conversation: { id: conversationId, type: 'group', name: 'TCS NQT Prep' },
    messageId: `m-${id}`,
    actor: { id: 'u-priya', name: 'Priya Sharma', role: 'mentor' },
    preview: 'Mock test on Saturday',
    readAt: null,
    createdAt: '2026-10-10T10:00:00.000Z',
  };
}

const state = () => useNotificationsStore.getState();
const unreadIds = () =>
  state()
    .items.filter((n) => !n.readAt)
    .map((n) => n.id);

beforeEach(async () => {
  state().reset();
  vi.mocked(fetchNotifications).mockResolvedValueOnce({
    notifications: [notification('n2', 'c2'), notification('n1')],
    hasMore: false,
    unreadCount: 2,
  });
  await state().load();
});

describe('notifications store', () => {
  it('puts a new notification first and takes the server count', () => {
    state().receive(notification('n3'), 3);

    expect(state().items.map((n) => n.id)).toEqual(['n3', 'n2', 'n1']);
    expect(state().unreadCount).toBe(3);
  });

  it('marks one as read straight away and then uses the count from the server', async () => {
    vi.mocked(markNotificationsRead).mockResolvedValueOnce({ unreadCount: 1 });

    const pending = state().markRead(['n1']);
    expect(unreadIds()).toEqual(['n2']);
    expect(state().unreadCount).toBe(1);
    await pending;

    expect(markNotificationsRead).toHaveBeenCalledWith(['n1']);
  });

  it('applies reads from other tabs by id, by conversation, or all at once', () => {
    state().applyRead({ unreadCount: 1, conversationId: 'c2' });
    expect(unreadIds()).toEqual(['n1']);

    state().applyRead({ unreadCount: 0 });
    expect(unreadIds()).toEqual([]);
    expect(state().unreadCount).toBe(0);
  });

  it('drops notifications about deleted messages', () => {
    state().applyRemoved(['n2'], 1);

    expect(state().items.map((n) => n.id)).toEqual(['n1']);
    expect(state().unreadCount).toBe(1);
  });
});
