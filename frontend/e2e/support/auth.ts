import {
  APIRequestContext,
  Browser,
  BrowserContext,
  expect,
  Page,
  TestInfo,
} from '@playwright/test';

export const DEMO_PASSWORD = 'Demo@1234';

export async function signIn(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** The chat list is the home screen for every signed-in user. */
export async function expectChatList(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Chats', exact: true })).toBeVisible();
}

/** Shown to users who do not belong to any conversation yet. */
export async function expectGreeting(page: Page, firstName: string): Promise<void> {
  await expect(
    page.getByRole('heading', { name: `Hi ${firstName}, no conversations yet` }),
  ).toBeVisible();
}

/** A chat row by its title, which is where each row's accessible name starts. */
export function chatLink(page: Page, title: string) {
  return page.getByRole('navigation', { name: 'Conversations' }).getByRole('link', {
    name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  });
}

/** A unique address per test run and device project, so reruns never collide. */
export function uniqueEmail(prefix: string, testInfo: TestInfo): string {
  return `${prefix}.${testInfo.project.name}.${Date.now()}@example.com`;
}

/** A fresh context with the current project's device settings: effectively a second browser. */
export function newBrowserSession(browser: Browser, testInfo: TestInfo): Promise<BrowserContext> {
  const { baseURL, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
    testInfo.project.use;
  return browser.newContext({
    baseURL,
    viewport,
    userAgent,
    deviceScaleFactor,
    isMobile,
    hasTouch,
  });
}

export async function signUp(
  request: APIRequestContext,
  account: { name: string; email: string; password: string; role: 'mentee' | 'mentor' },
): Promise<void> {
  const response = await request.post('/api/auth/signup', { data: account });
  expect(response.status()).toBe(201);
}
