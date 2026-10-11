import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const API_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

// The dev server forwards API calls and the WebSocket to NestJS so the browser talks to a
// single origin (which also keeps the SameSite=Strict refresh cookie working).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API_TARGET,
      '/socket.io': { target: API_TARGET, ws: true },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
