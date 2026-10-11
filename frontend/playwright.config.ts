import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// Dedicated ports and database, so browser tests never touch a running dev server
// or the development data.
const API_PORT = 3100;
const WEB_PORT = 5174;
const API_URL = `http://localhost:${API_PORT}`;
const TEST_DB_ENV = { NODE_ENV: 'test', MONGODB_DB_NAME: 'unsaidtalks_test' };

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npm run start:e2e',
      cwd: path.resolve(import.meta.dirname, '../backend'),
      url: `${API_URL}/api/health`,
      env: {
        ...TEST_DB_ENV,
        PORT: String(API_PORT),
        CLIENT_ORIGIN: `http://localhost:${WEB_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      // The same split as in production: HTTP goes through the web server's proxy (Vercel's
      // rewrite there) and the WebSocket connects to the API server directly.
      env: { API_PROXY_TARGET: API_URL, VITE_SOCKET_URL: API_URL },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
