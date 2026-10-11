import { Browser, expect, Page, test, TestInfo } from '@playwright/test';
import { chatLink, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog, sendMessage } from './support/chat';

function bubble(page: Page, text: string) {
  return messageLog(page).locator('[data-message-id]').filter({ hasText: text });
}

async function openActions(page: Page, text: string) {
  await bubble(page, text).getByRole('button', { name: 'Message actions' }).click();
}

async function sessionsFor(
  browser: Browser,
  testInfo: TestInfo,
  people: Array<{ email: string; group?: string }>,
) {
  const contexts = await Promise.all(people.map(() => newBrowserSession(browser, testInfo)));
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  for (const [index, { email, group }] of people.entries()) {
    await signIn(pages[index], email);
    if (group) await chatLink(pages[index], group).click();
  }
  const close = () => Promise.all(contexts.map((context) => context.close()));
  return { pages, close };
}

test.describe('deleting messages', () => {
  test('a mentee deletes their own message and it disappears for everyone', async ({
    browser,
    request,
  }, testInfo) => {
    const group = `Delete own ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, group, ['priya@demo.test', 'rahul@demo.test']);
    const {
      pages: [rahul, priya],
      close,
    } = await sessionsFor(browser, testInfo, [
      { email: 'rahul@demo.test', group },
      { email: 'priya@demo.test', group },
    ]);

    const text = 'Sent this to the wrong group, sorry';
    await sendMessage(rahul, text);
    await expect(bubble(priya, text)).toBeVisible();

    await openActions(rahul, text);
    await rahul.getByRole('menuitem', { name: 'Delete for everyone' }).click();
    const dialog = rahul.getByRole('dialog', { name: 'Delete message?' });
    await expect(dialog).toContainText(text);
    await dialog.getByRole('button', { name: 'Delete for everyone' }).click();

    await expect(messageLog(rahul).getByText('This message was deleted')).toBeVisible();
    await expect(messageLog(priya).getByText('This message was deleted')).toBeVisible();
    await expect(messageLog(priya).getByText(text)).toHaveCount(0);

    await close();
  });

  test('a mentor removes a mentee message, while mentees cannot delete others', async ({
    browser,
    request,
  }, testInfo) => {
    const group = `Delete other ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, group, ['priya@demo.test', 'rahul@demo.test']);
    const {
      pages: [rahul, priya],
      close,
    } = await sessionsFor(browser, testInfo, [
      { email: 'rahul@demo.test', group },
      { email: 'priya@demo.test', group },
    ]);

    await sendMessage(priya, 'Class at 7 PM');
    await openActions(rahul, 'Class at 7 PM');
    await expect(rahul.getByRole('menuitem', { name: 'Report' })).toBeVisible();
    await expect(rahul.getByRole('menuitem', { name: 'Delete for everyone' })).toHaveCount(0);
    await rahul.keyboard.press('Escape');

    await sendMessage(rahul, 'Off-topic meme');
    await openActions(priya, 'Off-topic meme');
    await priya.getByRole('menuitem', { name: 'Delete for everyone' }).click();
    const dialog = priya.getByRole('dialog', { name: 'Delete message?' });
    await expect(dialog).toContainText('as a moderator');
    await dialog.getByRole('button', { name: 'Delete for everyone' }).click();

    await expect(
      messageLog(rahul).getByText('This message was removed by a mentor or admin'),
    ).toBeVisible();

    await close();
  });
});

test.describe('reporting messages', () => {
  test('a reported message reaches the admin, who removes it', async ({
    browser,
    request,
  }, testInfo) => {
    const group = `Reports ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, group, ['priya@demo.test', 'rahul@demo.test', 'sneha@demo.test']);
    const {
      pages: [rahul, sneha, admin],
      close,
    } = await sessionsFor(browser, testInfo, [
      { email: 'rahul@demo.test', group },
      { email: 'sneha@demo.test', group },
      { email: 'admin@demo.test' },
    ]);

    const text = `Only careless people fail mocks ${testInfo.project.name}`;
    await sendMessage(rahul, text);
    await openActions(sneha, text);
    await sneha.getByRole('menuitem', { name: 'Report' }).click();
    const dialog = sneha.getByRole('dialog', { name: 'Report message' });
    await dialog.getByLabel('Abuse or harassment').check();
    await dialog.getByRole('textbox').fill('Putting other mentees down');
    await dialog.getByRole('button', { name: 'Send report' }).click();
    await expect(
      sneha.getByRole('status').filter({ hasText: 'Thanks for reporting' }),
    ).toBeVisible();

    await admin.goto('/admin/reports');
    const card = admin.getByRole('listitem').filter({ hasText: text });
    await expect(card).toContainText(group);
    await expect(card).toContainText('Abuse or harassment');
    await expect(card).toContainText('Putting other mentees down');
    await expect(card).toContainText('sneha@demo.test');

    await card.getByRole('button', { name: 'Delete message' }).click();
    await card.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(admin.getByRole('listitem').filter({ hasText: text })).toHaveCount(0);
    await expect(
      messageLog(rahul).getByText('This message was removed by a mentor or admin'),
    ).toBeVisible();

    await admin.getByRole('radio', { name: 'Removed' }).click();
    await expect(admin.getByRole('listitem').filter({ hasText: text })).toContainText(
      'Removed by Ananya Rao',
    );

    await close();
  });
});

test.describe('notifications', () => {
  test('a reply notifies its author, who opens it from the bell', async ({
    browser,
    request,
  }, testInfo) => {
    const group = `Replies ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, group, ['priya@demo.test', 'rahul@demo.test']);
    const {
      pages: [rahul, priya],
      close,
    } = await sessionsFor(browser, testInfo, [
      { email: 'rahul@demo.test', group },
      { email: 'priya@demo.test', group },
    ]);

    const question = 'Will the mock test be online?';
    await sendMessage(rahul, question);
    // Back on the chat list, so the reply arrives while Rahul is elsewhere.
    await rahul.goto('/');

    await openActions(priya, question);
    await priya.getByRole('menuitem', { name: 'Reply' }).click();
    await sendMessage(priya, 'Yes, on the portal at 10 AM.');

    const summary = `Priya Sharma replied to your message in ${group}`;
    await expect(rahul.getByRole('status').filter({ hasText: summary })).toBeVisible();
    await rahul.getByRole('button', { name: /^Notifications, \d+ unread$/ }).click();
    const panel = rahul.getByRole('dialog', { name: 'Notifications' });
    await panel.getByRole('button', { name: new RegExp(summary) }).click();

    await expect(panel).toHaveCount(0);
    await expect(bubble(rahul, 'Yes, on the portal at 10 AM.')).toBeInViewport();

    await close();
  });
});
