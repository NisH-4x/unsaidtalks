import { useCallback, useEffect, useRef } from 'react';
import { socket } from './socket';
import { SocketEvent } from './socketEvents';

const REFRESH_EVERY_MS = 3_000;
const IDLE_AFTER_MS = 4_000;

/**
 * Tells the conversation that this user is typing: at most one signal every few seconds
 * while keys are pressed, and a stop signal after a pause, on send or on leaving. Signals
 * are volatile, so nothing stale is replayed after a reconnect.
 */
export function useTypingSignal(conversationId: string) {
  const lastSentAt = useRef(0);
  const idleTimer = useRef<number>();

  const stop = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    if (lastSentAt.current === 0) return;
    lastSentAt.current = 0;
    socket.volatile.emit(SocketEvent.TypingStop, { conversationId });
  }, [conversationId]);

  const typed = useCallback(() => {
    const now = Date.now();
    if (now - lastSentAt.current > REFRESH_EVERY_MS) {
      lastSentAt.current = now;
      socket.volatile.emit(SocketEvent.TypingStart, { conversationId });
    }
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(stop, IDLE_AFTER_MS);
  }, [conversationId, stop]);

  useEffect(() => stop, [stop]);

  return { typed, stop };
}
