import { io, Socket } from 'socket.io-client';

const EVENT_TIMEOUT_MS = 5_000;

/** Connects to the chat namespace the same way the web client does: WebSocket only, token in the handshake. */
export function connectSocket(baseUrl: string, token: string | undefined): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`${baseUrl}/chat`, {
      transports: ['websocket'],
      auth: token ? { token } : {},
      forceNew: true,
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

export function nextEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      EVENT_TIMEOUT_MS,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolves if the event does not arrive within the wait, rejects if it does. */
export function expectNoEvent(socket: Socket, event: string, waitMs = 700): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEvent = () => {
      clearTimeout(timer);
      reject(new Error(`Unexpected "${event}" event`));
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, waitMs);
    socket.once(event, onEvent);
  });
}

export function emitWithAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return socket.timeout(EVENT_TIMEOUT_MS).emitWithAck(event, payload) as Promise<T>;
}
