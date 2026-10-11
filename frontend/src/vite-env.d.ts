/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the API server for the WebSocket, e.g. https://unsaidtalks-api.onrender.com. */
  readonly VITE_SOCKET_URL?: string;
}
