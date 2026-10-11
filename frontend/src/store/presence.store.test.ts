import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TYPING_EXPIRY_MS, usePresenceStore } from './presence.store';

const typing = (conversationId: string) => usePresenceStore.getState().typing[conversationId] ?? [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', globalThis);
  usePresenceStore.getState().reset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('presence store', () => {
  it('tracks who comes online and goes offline with a last-seen time', () => {
    const { setOnline, applyUpdate } = usePresenceStore.getState();
    setOnline(['priya']);
    applyUpdate({ userId: 'arjun', online: true });
    applyUpdate({ userId: 'priya', online: false, lastSeenAt: '2026-10-10T18:00:00.000Z' });

    const state = usePresenceStore.getState();
    expect(Object.keys(state.onlineIds)).toEqual(['arjun']);
    expect(state.lastSeenAt.priya).toBe('2026-10-10T18:00:00.000Z');
  });

  it('keeps the newest last-seen time when older data is loaded later', () => {
    const { applyUpdate, rememberLastSeen } = usePresenceStore.getState();
    applyUpdate({ userId: 'priya', online: false, lastSeenAt: '2026-10-10T18:00:00.000Z' });

    rememberLastSeen([
      { id: 'priya', lastSeenAt: '2026-10-09T08:00:00.000Z' },
      { id: 'arjun', lastSeenAt: '2026-10-10T09:00:00.000Z' },
    ]);

    expect(usePresenceStore.getState().lastSeenAt).toEqual({
      priya: '2026-10-10T18:00:00.000Z',
      arjun: '2026-10-10T09:00:00.000Z',
    });
  });

  it('shows typing until the person stops', () => {
    const { setTyping } = usePresenceStore.getState();
    setTyping({ conversationId: 'c1', userId: 'priya', name: 'Priya', isTyping: true });
    setTyping({ conversationId: 'c1', userId: 'arjun', name: 'Arjun', isTyping: true });
    expect(typing('c1').map((t) => t.name)).toEqual(['Priya', 'Arjun']);

    setTyping({ conversationId: 'c1', userId: 'priya', name: 'Priya', isTyping: false });
    expect(typing('c1').map((t) => t.name)).toEqual(['Arjun']);
  });

  it('clears a typing indicator on its own if no update arrives', () => {
    const { setTyping } = usePresenceStore.getState();
    setTyping({ conversationId: 'c1', userId: 'priya', name: 'Priya', isTyping: true });

    vi.advanceTimersByTime(TYPING_EXPIRY_MS - 100);
    setTyping({ conversationId: 'c1', userId: 'priya', name: 'Priya', isTyping: true });
    vi.advanceTimersByTime(TYPING_EXPIRY_MS - 100);
    expect(typing('c1')).toHaveLength(1);

    vi.advanceTimersByTime(200);
    expect(typing('c1')).toHaveLength(0);
  });
});
