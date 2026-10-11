import { create } from 'zustand';
import { PresenceUpdatePayload, TypingPayload } from '../realtime/socketEvents';

export interface Typist {
  userId: string;
  name: string;
}

interface PresenceState {
  onlineIds: Record<string, true>;
  lastSeenAt: Record<string, string>;
  /** People currently typing, per conversation. */
  typing: Record<string, Typist[]>;
  setOnline: (userIds: string[]) => void;
  applyUpdate: (update: PresenceUpdatePayload) => void;
  rememberLastSeen: (users: Array<{ id: string; lastSeenAt: string | null }>) => void;
  setTyping: (event: TypingPayload) => void;
  reset: () => void;
}

/**
 * A typing indicator disappears on its own if no refresh arrives in time, so a lost
 * "stopped typing" signal (for example after a dropped connection) cannot leave it stuck.
 */
export const TYPING_EXPIRY_MS = 6_000;
const typingTimers = new Map<string, number>();

function withoutTypist(list: Typist[] | undefined, userId: string): Typist[] {
  return (list ?? []).filter((typist) => typist.userId !== userId);
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineIds: {},
  lastSeenAt: {},
  typing: {},

  setOnline: (userIds) =>
    set({ onlineIds: Object.fromEntries(userIds.map((id) => [id, true as const])) }),

  applyUpdate: ({ userId, online, lastSeenAt }) =>
    set((state) => {
      const onlineIds = { ...state.onlineIds };
      if (online) onlineIds[userId] = true;
      else delete onlineIds[userId];
      return {
        onlineIds,
        lastSeenAt: lastSeenAt ? { ...state.lastSeenAt, [userId]: lastSeenAt } : state.lastSeenAt,
      };
    }),

  // Server-loaded values only fill gaps or replace older ones; live updates are newer.
  rememberLastSeen: (users) =>
    set((state) => {
      const lastSeenAt = { ...state.lastSeenAt };
      for (const { id, lastSeenAt: seen } of users) {
        if (seen && (!lastSeenAt[id] || lastSeenAt[id] < seen)) lastSeenAt[id] = seen;
      }
      return { lastSeenAt };
    }),

  setTyping: ({ conversationId, userId, name, isTyping }) => {
    const key = `${conversationId}:${userId}`;
    window.clearTimeout(typingTimers.get(key));
    typingTimers.delete(key);

    const others = withoutTypist(get().typing[conversationId], userId);
    const next = isTyping ? [...others, { userId, name }] : others;
    set((state) => ({ typing: { ...state.typing, [conversationId]: next } }));

    if (isTyping) {
      typingTimers.set(
        key,
        window.setTimeout(() => {
          typingTimers.delete(key);
          set((state) => ({
            typing: {
              ...state.typing,
              [conversationId]: withoutTypist(state.typing[conversationId], userId),
            },
          }));
        }, TYPING_EXPIRY_MS),
      );
    }
  },

  reset: () => {
    typingTimers.forEach((timer) => window.clearTimeout(timer));
    typingTimers.clear();
    set({ onlineIds: {}, lastSeenAt: {}, typing: {} });
  },
}));

export function useIsOnline(userId: string | undefined): boolean {
  return usePresenceStore((state) => Boolean(userId && state.onlineIds[userId]));
}

const NOBODY: Typist[] = [];

export function useTypists(conversationId: string): Typist[] {
  return usePresenceStore((state) => state.typing[conversationId] ?? NOBODY);
}
