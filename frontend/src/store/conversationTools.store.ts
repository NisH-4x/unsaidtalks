import { create } from 'zustand';
import { listPins } from '../api/messageTools.api';
import { Message } from '../types/message';

interface ConversationToolsState {
  /** Pinned messages per conversation, most recently pinned first. */
  pins: Record<string, Message[]>;
  /** Bumped whenever a pin, doubt or announcement changes, so open lists know to refetch. */
  revision: number;
  loadPins: (conversationId: string) => Promise<void>;
  applyUpdate: (message: Message) => void;
  noteNewMessage: (message: Message) => void;
  /** Makes open lists refetch, for example after a reconnect may have missed changes. */
  invalidate: () => void;
  reset: () => void;
}

const byPinnedAtDesc = (a: Message, b: Message) =>
  (b.pin?.pinnedAt ?? '').localeCompare(a.pin?.pinnedAt ?? '');

export const useConversationToolsStore = create<ConversationToolsState>((set, get) => ({
  pins: {},
  revision: 0,

  loadPins: async (conversationId) => {
    try {
      const pinned = await listPins(conversationId);
      set((state) => ({ pins: { ...state.pins, [conversationId]: pinned } }));
    } catch {
      // The pinned bar is optional; the conversation still works without it.
    }
  },

  applyUpdate: (message) =>
    set((state) => {
      const current = state.pins[message.conversationId];
      const revision = state.revision + 1;
      if (!current) return { revision };

      const others = current.filter((m) => m.id !== message.id);
      const pinned = message.pin && !message.isDeleted ? [...others, message] : others;
      return {
        revision,
        pins: { ...state.pins, [message.conversationId]: pinned.sort(byPinnedAtDesc) },
      };
    }),

  noteNewMessage: (message) => {
    if (message.isAnnouncement || message.doubt) get().invalidate();
  },

  invalidate: () => set((state) => ({ revision: state.revision + 1 })),

  reset: () => set({ pins: {}, revision: 0 }),
}));
