import { expect, Page, test } from '@playwright/test';
import { chatLink, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog, sendMessage } from './support/chat';

function bubble(page: Page, text: string) {
  return messageLog(page).locator('[data-message-id]').filter({ hasText: text });
}

test('read ticks, message info and reactions update live in both browsers', async ({
  browser,
  request,
}, testInfo) => {
  const group = `Receipts ${testInfo.project.name} ${Date.now()}`;
  await createGroup(request, group, ['priya@demo.test', 'rahul@demo.test']);
  const priyaSession = await newBrowserSession(browser, testInfo);
  const rahulSession = await newBrowserSession(browser, testInfo);
  const priya = await priyaSession.newPage();
  const rahul = await rahulSession.newPage();

  await signIn(priya, 'priya@demo.test');
  await chatLink(priya, group).click();
  const text = 'Mock test results are out';
  await sendMessage(priya, text);
  await expect(bubble(priya, text).getByLabel('Sent')).toBeVisible();

  await signIn(rahul, 'rahul@demo.test');
  await chatLink(rahul, group).click();
  await expect(bubble(rahul, text)).toBeVisible();
  await expect(bubble(priya, text).getByLabel('Read')).toBeVisible();

  await bubble(priya, text).getByRole('button', { name: 'Message actions' }).click();
  await priya.getByRole('menuitem', { name: 'Message info' }).click();
  const info = priya.getByRole('dialog', { name: 'Message info' });
  await expect(info).toContainText('Read by · 1');
  await expect(info).toContainText('Rahul Verma');
  await priya.keyboard.press('Escape');

  await bubble(rahul, text).getByRole('button', { name: 'Message actions' }).click();
  await rahul.getByRole('menuitem', { name: 'React with 🎉' }).click();
  await expect(
    bubble(priya, text).getByRole('button', { name: '🎉 1: Rahul Verma' }),
  ).toBeVisible();

  await bubble(rahul, text).getByRole('button', { name: '🎉 1: You' }).click();
  await expect(bubble(priya, text).getByRole('button', { name: /🎉/ })).toHaveCount(0);

  await priyaSession.close();
  await rahulSession.close();
});
