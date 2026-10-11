import { create } from 'zustand';
import { toApiError } from '../api/errors';
import { fetchNotifications, markNotificationsRead } from '../api/notifications.api';
import { AppNotification } from '../types/notification';

interface ReadUpdate {
  unreadCount: number;
  /** Which notifications were read: the listed ones, one conversation's, or (neither) all. */
  ids?: string[];
  conversationId?: string;
}

interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  loadingMore: boolean;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  receive: (notification: AppNotification, unreadCount: number) => void;
  markRead: (ids?: string[]) => Promise<void>;
  applyRead: (update: ReadUpdate) => void;
  applyRemoved: (ids: string[], unreadCount: number) => void;
  reset: () => void;
}

const initialState = {
  items: [],
  unreadCount: 0,
  hasMore: false,
  status: 'idle' as const,
  error: null,
  loadingMore: false,
};

function matchesRead({ ids, conversationId }: ReadUpdate) {
  return (notification: AppNotification) => {
    if (ids) return ids.includes(notification.id);
    if (conversationId) return notification.conversation.id === conversationId;
    return true;
  };
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  ...initialState,

  load: async () => {
    if (get().status !== 'ready') set({ status: 'loading', error: null });
    try {
      const page = await fetchNotifications();
      set({
        items: page.notifications,
        hasMore: page.hasMore,
        unreadCount: page.unreadCount,
        status: 'ready',
        error: null,
      });
    } catch (error) {
      if (get().status !== 'ready') set({ status: 'error', error: toApiError(error).message });
    }
  },

  loadMore: async () => {
    const { items, hasMore, loadingMore } = get();
    const oldest = items.at(-1);
    if (!oldest || !hasMore || loadingMore) return;

    set({ loadingMore: true });
    try {
      const page = await fetchNotifications(oldest.id);
      set((state) => ({
        items: [
          ...state.items,
          ...page.notifications.filter((n) => !state.items.some((i) => i.id === n.id)),
        ],
        hasMore: page.hasMore,
        loadingMore: false,
      }));
    } catch {
      set({ loadingMore: false });
    }
  },

  receive: (notification, unreadCount) =>
    set((state) => ({
      items: [notification, ...state.items.filter((n) => n.id !== notification.id)],
      unreadCount,
    })),

  // Shown as read at once; the server's count then replaces the local guess.
  markRead: async (ids) => {
    const now = new Date().toISOString();
    const isTarget = matchesRead({ unreadCount: 0, ids });
    set((state) => ({
      items: state.items.map((n) => (isTarget(n) && !n.readAt ? { ...n, readAt: now } : n)),
      unreadCount: ids
        ? Math.max(
            0,
            state.unreadCount - state.items.filter((n) => isTarget(n) && !n.readAt).length,
          )
        : 0,
    }));
    try {
      const { unreadCount } = await markNotificationsRead(ids);
      set({ unreadCount });
    } catch {
      void get().load();
    }
  },

  applyRead: (update) => {
    const now = new Date().toISOString();
    const isTarget = matchesRead(update);
    set((state) => ({
      items: state.items.map((n) => (isTarget(n) && !n.readAt ? { ...n, readAt: now } : n)),
      unreadCount: update.unreadCount,
    }));
  },

  applyRemoved: (ids, unreadCount) =>
    set((state) => ({ items: state.items.filter((n) => !ids.includes(n.id)), unreadCount })),

  reset: () => set(initialState),
}));
