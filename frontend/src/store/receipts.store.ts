import { create } from 'zustand';

interface ReceiptsState {
  /** Per conversation, how far each member has read (the id of the last message they saw). */
  positions: Record<string, Record<string, string | null>>;
  setMembers: (
    conversationId: string,
    members: Array<{ id: string; lastReadMessageId: string | null }>,
  ) => void;
  /** Moves a member's position forward; an older position never replaces a newer one. */
  apply: (conversationId: string, userId: string, lastReadMessageId: string | null) => void;
  reset: () => void;
}

const later = (a: string | null | undefined, b: string | null) => {
  if (!a) return b;
  if (!b) return a;
  return b > a ? b : a;
};

export const useReceiptsStore = create<ReceiptsState>((set) => ({
  positions: {},

  setMembers: (conversationId, members) =>
    set((state) => {
      const known = state.positions[conversationId] ?? {};
      const merged = Object.fromEntries(
        members.map(({ id, lastReadMessageId }) => [id, later(known[id], lastReadMessageId)]),
      );
      return { positions: { ...state.positions, [conversationId]: merged } };
    }),

  apply: (conversationId, userId, lastReadMessageId) =>
    set((state) => {
      const current = state.positions[conversationId] ?? {};
      const next = later(current[userId], lastReadMessageId);
      if (next === current[userId]) return state;
      return {
        positions: { ...state.positions, [conversationId]: { ...current, [userId]: next } },
      };
    }),

  reset: () => set({ positions: {} }),
}));
