import { expect, Page, test } from '@playwright/test';
import { chatLink, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog, sendMessage } from './support/chat';

function bubble(page: Page, text: string) {
  return messageLog(page).locator('[data-message-id]').filter({ hasText: text });
}

async function openGroup(page: Page, request: Parameters<typeof createGroup>[0], name: string) {
  await createGroup(request, name, ['priya@demo.test', 'rahul@demo.test']);
  await signIn(page, 'rahul@demo.test');
  await chatLink(page, name).click();
}

test('the emoji popup adds emoji, searches, closes on an outside click and remembers', async ({
  page,
  request,
}, testInfo) => {
  await openGroup(page, request, `Emoji ${testInfo.project.name} ${Date.now()}`);
  const box = page.getByRole('textbox', { name: 'Message' });
  await box.fill('Great session');

  await page.getByRole('button', { name: 'Add emoji' }).click();
  const popup = page.getByRole('dialog', { name: 'Emoji' });
  await expect(popup).toBeInViewport({ ratio: 1 });
  await popup.getByRole('button', { name: 'Food, fun and nature' }).click();
  await popup.getByRole('button', { name: '🎉' }).click();

  // Enter in the search box picks the first result and does not send the message.
  await popup.getByRole('searchbox', { name: 'Search emoji' }).fill('raising both');
  await popup.getByRole('searchbox', { name: 'Search emoji' }).press('Enter');
  await expect(box).toHaveValue('Great session🎉🙌');
  await popup.getByRole('searchbox', { name: 'Search emoji' }).fill('xylophone');
  await expect(popup.getByText('No emoji found')).toBeVisible();

  await messageLog(page).click({ position: { x: 20, y: 20 } });
  await expect(popup).toBeHidden();
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(bubble(page, 'Great session🎉🙌')).toBeVisible();

  await page.getByRole('button', { name: 'Add emoji' }).click();
  const recent = popup.getByRole('region', { name: 'Recently used' });
  await expect(recent.getByRole('button').first()).toHaveText('🙌');
  await expect(recent.getByRole('button').nth(1)).toHaveText('🎉');
  await page.keyboard.press('Escape');
  await expect(popup).toBeHidden();
});

test('the message menu stays on screen, beside the bubble or as a sheet on phones', async ({
  browser,
  page,
  request,
}, testInfo) => {
  const group = `Menu ${testInfo.project.name} ${Date.now()}`;
  const text = 'Revise percentages before Friday';
  const priyaSession = await newBrowserSession(browser, testInfo);
  const priya = await priyaSession.newPage();
  await openGroup(page, request, group);
  await signIn(priya, 'priya@demo.test');
  await chatLink(priya, group).click();
  await sendMessage(priya, text);
  await priyaSession.close();

  await bubble(page, text).getByRole('button', { name: 'Message actions' }).click();
  const menu = page.getByRole('menu', { name: 'Message actions' });
  await expect(menu.getByRole('menuitem', { name: 'Reply' })).toBeVisible();

  await expect(menu).toBeInViewport({ ratio: 1 });

  await menu.getByRole('menuitem', { name: 'React with 👍' }).click();
  await expect(menu).toBeHidden();
  await expect(bubble(page, text).getByRole('button', { name: '👍 1: You' })).toBeVisible();
});

test('on a phone, holding a message opens its actions', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch and hold is a touch-screen gesture');
  const group = `Hold ${Date.now()}`;
  await openGroup(page, request, group);
  await sendMessage(page, 'Can we get extra practice sets?');
  const sent = bubble(page, 'Can we get extra practice sets?');
  // Actions are offered once the server has stored the message.
  await expect(sent.getByLabel(/^(Sent|Read)$/)).toBeVisible();
  const target = sent.getByText('Can we get extra');

  const box = (await target.boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  const menu = page.getByRole('menu', { name: 'Message actions' });
  await expect(menu).toBeVisible();
  await expect(
    page.getByText('You: Can we get extra practice sets?').filter({ visible: true }),
  ).toBeVisible();

  // A quick tap is not a hold.
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await target.tap();
  await expect(menu).toBeHidden();
});
