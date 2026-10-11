import { expect, test } from '@playwright/test';
import { chatLink, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog, sendMessage } from './support/chat';

test('a sender fixes a typo and the other person sees the edit live', async ({
  browser,
  request,
}, testInfo) => {
  const group = `Edits ${testInfo.project.name} ${Date.now()}`;
  await createGroup(request, group, ['priya@demo.test', 'rahul@demo.test']);
  const rahulSession = await newBrowserSession(browser, testInfo);
  const priyaSession = await newBrowserSession(browser, testInfo);
  const rahul = await rahulSession.newPage();
  const priya = await priyaSession.newPage();
  for (const [page, email] of [
    [rahul, 'rahul@demo.test'],
    [priya, 'priya@demo.test'],
  ] as const) {
    await signIn(page, email);
    await chatLink(page, group).click();
  }

  await sendMessage(rahul, 'Is the mock on Satuday?');
  const ownBubble = messageLog(rahul).locator('[data-message-id]').filter({ hasText: 'Satuday' });
  await ownBubble.getByRole('button', { name: 'Message actions' }).click();
  await rahul.getByRole('menuitem', { name: 'Edit' }).click();

  await expect(rahul.getByText('Editing message')).toBeVisible();
  const box = rahul.getByRole('textbox', { name: 'Message' });
  await expect(box).toHaveValue('Is the mock on Satuday?');
  await box.fill('Is the mock on Saturday?');
  await rahul.getByRole('button', { name: 'Save changes' }).click();

  await expect(rahul.getByText('Editing message')).toHaveCount(0);
  const seenByPriya = messageLog(priya)
    .locator('[data-message-id]')
    .filter({ hasText: 'Is the mock on Saturday?' });
  await expect(seenByPriya).toContainText('edited');
  await expect(messageLog(priya).getByText('Satuday')).toHaveCount(0);

  await rahulSession.close();
  await priyaSession.close();
});
