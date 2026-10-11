import { io } from 'socket.io-client';
import { create } from 'zustand';
import { useAuthStore } from '../store/auth.store';
import { Ack } from './socketEvents';

export type ConnectionStatus = 'offline' | 'connecting' | 'connected' | 'reconnecting';

export const useConnectionStore = create<{ status: ConnectionStatus }>(() => ({
  status: 'offline',
}));

// Locally the Vite dev server forwards the socket. In production the app is served by
// Vercel, which does not forward WebSockets, so the socket connects to the API server directly.
const SOCKET_ORIGIN = (import.meta.env.VITE_SOCKET_URL ?? '').replace(/\/+$/, '');

/**
 * The single chat connection for this tab. WebSocket only (no long-polling fallback),
 * and the current access token is read again on every reconnect attempt.
 */
export const socket = io(`${SOCKET_ORIGIN}/chat`, {
  path: '/socket.io',
  transports: ['websocket'],
  autoConnect: false,
  // A connection that drops before its handshake completes is only retried once the
  // attempt times out (20 s by default), so a shorter limit gets people back sooner.
  timeout: 8_000,
  reconnectionDelayMax: 5_000,
  auth: (provide) => provide({ token: useAuthStore.getState().accessToken }),
});

const ACK_TIMEOUT_MS = 10_000;

export async function emitWithAck<T extends object>(
  event: string,
  payload: unknown,
): Promise<Ack<T>> {
  try {
    return (await socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)) as Ack<T>;
  } catch {
    return { ok: false, error: 'No response from the server. Check your connection.' };
  }
}
