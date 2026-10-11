import { expect, Page, test } from '@playwright/test';
import { chatLink, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog, sendMessage } from './support/chat';

interface RecordedNotification {
  title: string;
  body?: string;
  tag?: string;
}

declare global {
  interface Window {
    desktopLog: { requests: number; shown: RecordedNotification[]; focused: boolean };
  }
}

// Stands in for the browser's Notification API and window focus, which headless browsers
// cannot show or change, so the test can see exactly what the app asks for. Like a real
// browser, a granted permission outlives page reloads.
function fakeNotificationApi() {
  window.desktopLog = { requests: 0, shown: [], focused: false };
  class FakeNotification {
    static get permission(): NotificationPermission {
      return localStorage.getItem('fake-permission') === 'granted' ? 'granted' : 'default';
    }
    static requestPermission() {
      window.desktopLog.requests += 1;
      localStorage.setItem('fake-permission', 'granted');
      return Promise.resolve(FakeNotification.permission);
    }
    onclick: (() => void) | null = null;
    constructor(title: string, options: NotificationOptions = {}) {
      window.desktopLog.shown.push({ title, body: options.body, tag: options.tag });
    }
    close() {}
  }
  Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
  document.hasFocus = () => window.desktopLog.focused;
}

const desktopLog = (page: Page) => page.evaluate(() => window.desktopLog);

async function reply(page: Page, question: string, answer: string) {
  await messageLog(page)
    .locator('[data-message-id]')
    .filter({ hasText: question })
    .first()
    .getByRole('button', { name: 'Message actions' })
    .click();
  await page.getByRole('menuitem', { name: 'Reply' }).click();
  await sendMessage(page, answer);
}

test('desktop notifications are opt-in and only shown while the app is out of focus', async ({
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Covered by the unsupported-browser test');

  const group = `Desktop alerts ${Date.now()}`;
  await createGroup(request, group, ['priya@demo.test', 'rahul@demo.test']);
  const rahulContext = await newBrowserSession(browser, testInfo);
  await rahulContext.addInitScript(fakeNotificationApi);
  const priyaContext = await newBrowserSession(browser, testInfo);
  const rahul = await rahulContext.newPage();
  const priya = await priyaContext.newPage();
  for (const page of [rahul, priya]) {
    await signIn(page, page === rahul ? 'rahul@demo.test' : 'priya@demo.test');
    await chatLink(page, group).click();
  }

  await sendMessage(rahul, 'Is the aptitude round negative-marked?');
  await sendMessage(rahul, 'And is there a sectional cut-off?');
  await rahul.goto('/');

  await reply(priya, 'negative-marked', 'No negative marking this year.');
  const firstSummary = `Priya Sharma replied to your message in ${group}`;
  await expect(rahul.getByRole('status').filter({ hasText: firstSummary })).toBeVisible();
  expect(await desktopLog(rahul)).toMatchObject({ requests: 0, shown: [] });

  await rahul.getByRole('button', { name: /^Notifications, \d+ unread$/ }).click();
  const panel = rahul.getByRole('dialog', { name: 'Notifications' });
  const setting = panel.getByRole('switch', { name: 'Desktop notifications' });
  await setting.click();
  await expect(setting).toHaveAttribute('aria-checked', 'true');
  expect((await desktopLog(rahul)).requests).toBe(1);
  await rahul.keyboard.press('Escape');

  await reply(priya, 'sectional cut-off', 'Yes, 60 percent in each section.');
  await expect.poll(async () => (await desktopLog(rahul)).shown).toHaveLength(1);
  const [shown] = (await desktopLog(rahul)).shown;
  expect(shown.title).toBe(firstSummary);
  expect(shown.body).not.toContain('60 percent');

  await rahul.evaluate(() => (window.desktopLog.focused = true));
  await reply(priya, 'negative-marked', 'Mock tests follow the same pattern.');
  await expect(rahul.getByRole('button', { name: /^Notifications, 3 unread$/ })).toBeVisible();
  expect((await desktopLog(rahul)).shown).toHaveLength(1);

  await rahul.reload();
  await rahul.getByRole('button', { name: /^Notifications, \d+ unread$/ }).click();
  await expect(setting).toHaveAttribute('aria-checked', 'true');
  await setting.click();
  await expect(setting).toHaveAttribute('aria-checked', 'false');
  await rahul.keyboard.press('Escape');
  await reply(priya, 'sectional cut-off', 'Practice sets are in the files tab.');
  await expect(rahul.getByRole('button', { name: /^Notifications, 4 unread$/ })).toBeVisible();
  expect((await desktopLog(rahul)).shown).toHaveLength(0);

  await rahulContext.close();
  await priyaContext.close();
});

test('browsers without page notifications explain that instead of offering the setting', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Android only allows service-worker notifications');

  await signIn(page, 'rahul@demo.test');
  await page.getByRole('button', { name: /^Notifications/ }).click();
  const panel = page.getByRole('dialog', { name: 'Notifications' });
  await expect(panel.getByText('This browser cannot show desktop notifications.')).toBeVisible();
  await expect(panel.getByRole('switch', { name: 'Desktop notifications' })).toHaveCount(0);
});
