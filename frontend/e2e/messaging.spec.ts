import { expect, test, WebSocketRoute } from '@playwright/test';
import { chatLink, expectChatList, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog, sendMessage } from './support/chat';

test.describe('real-time messaging', () => {
  test('a mentor and a mentee chat live in two separate browsers', async ({
    browser,
    request,
  }, testInfo) => {
    const groupName = `Live Chat ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['priya@demo.test', 'rahul@demo.test']);

    const mentorSession = await newBrowserSession(browser, testInfo);
    const menteeSession = await newBrowserSession(browser, testInfo);
    const mentor = await mentorSession.newPage();
    const mentee = await menteeSession.newPage();

    await signIn(mentor, 'priya@demo.test');
    await chatLink(mentor, groupName).click();
    await signIn(mentee, 'rahul@demo.test');
    await chatLink(mentee, groupName).click();

    const question = "Tonight's class starts at 7 PM. Please be on time!";
    await sendMessage(mentor, question);
    await expect(messageLog(mentor).getByText(question)).toBeVisible();
    await expect(
      messageLog(mentor)
        .getByLabel(/^(Sent|Read)$/)
        .last(),
    ).toBeVisible();

    const received = messageLog(mentee).locator('[data-message-id]').filter({ hasText: question });
    await expect(received).toBeVisible();
    await expect(received).toContainText('Priya Sharma');
    await expect(received).toContainText('Mentor');

    const reply = 'Thank you ma’am, I will be there.';
    await sendMessage(mentee, reply);
    await expect(messageLog(mentor).getByText(reply)).toBeVisible();

    await mentee.reload();
    await expect(messageLog(mentee).getByText(question)).toBeVisible();
    await expect(messageLog(mentee).getByText(reply)).toBeVisible();

    await mentorSession.close();
    await menteeSession.close();
  });

  test('pressing Enter sends on a keyboard; Shift+Enter adds a line', async ({
    page,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Touch keyboards use the send button');
    const groupName = `Keyboard ${Date.now()}`;
    await createGroup(request, groupName, ['priya@demo.test']);

    await signIn(page, 'priya@demo.test');
    await chatLink(page, groupName).click();
    const box = page.getByRole('textbox', { name: 'Message' });
    await box.fill('Line one');
    await box.press('Shift+Enter');
    await box.pressSequentially('Line two');
    await box.press('Enter');

    await expect(messageLog(page).getByText(/Line one\s+Line two/)).toBeVisible();
    await expect(box).toHaveValue('');
  });

  test('unread counts and previews update live in the chat list', async ({
    browser,
    request,
  }, testInfo) => {
    const groupName = `Unread ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['arjun@demo.test', 'aman@demo.test']);

    const mentorSession = await newBrowserSession(browser, testInfo);
    const menteeSession = await newBrowserSession(browser, testInfo);
    const mentor = await mentorSession.newPage();
    const mentee = await menteeSession.newPage();

    await signIn(mentee, 'aman@demo.test');
    await expectChatList(mentee);
    await signIn(mentor, 'arjun@demo.test');
    await chatLink(mentor, groupName).click();

    await sendMessage(mentor, 'Coding round tomorrow');
    await sendMessage(mentor, 'Revise two-pointer problems');

    const row = chatLink(mentee, groupName);
    await expect(row.getByLabel('2 unread')).toBeVisible();
    await expect(row).toContainText('Arjun: Revise two-pointer problems');

    await row.click();
    await expect(messageLog(mentee).getByText('Revise two-pointer problems')).toBeVisible();
    if (testInfo.project.name === 'mobile') {
      await mentee.getByRole('link', { name: 'Back to chats' }).click();
    }
    await expect(chatLink(mentee, groupName).getByLabel(/unread/)).toHaveCount(0);

    await mentorSession.close();
    await menteeSession.close();
  });

  test('keeps one chat connection while moving between screens', async ({ page }, testInfo) => {
    const connections: string[] = [];
    page.on('websocket', (ws) => {
      if (ws.url().includes('/socket.io/')) connections.push(ws.url());
    });

    await signIn(page, 'sneha@demo.test');
    for (const title of ['TCS NQT Prep – Batch 12', 'Off-Campus Bootcamp – Batch 7']) {
      if (testInfo.project.name === 'mobile' && page.url().includes('/chats/')) {
        await page.getByRole('link', { name: 'Back to chats' }).click();
      }
      await chatLink(page, title).click();
      await messageLog(page).locator('[data-message-id]').first().waitFor();
    }

    expect(connections).toHaveLength(1);
  });

  test('older messages load when scrolling up', async ({ page }) => {
    await signIn(page, 'sneha@demo.test');
    await chatLink(page, 'TCS NQT Prep – Batch 12').click();

    const log = messageLog(page);
    await expect(log.locator('[data-message-id]')).toHaveCount(30);
    await expect(log.getByText('Ananya Rao created this group')).toHaveCount(0);

    await expect(async () => {
      await log.evaluate((element) => element.scrollTo({ top: 0 }));
      await expect(log.getByText('This is the start of the conversation.')).toBeVisible({
        timeout: 1000,
      });
    }).toPass({ timeout: 15_000 });
    await expect(log.getByText('Ananya Rao created this group')).toBeVisible();
    await expect(log.locator('[data-message-id]')).toHaveCount(39);
  });

  test('reconnects and catches up on messages missed while offline', async ({
    browser,
    request,
  }, testInfo) => {
    const groupName = `Reconnect ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['kavya@demo.test', 'neha@demo.test']);

    const mentorSession = await newBrowserSession(browser, testInfo);
    const menteeSession = await newBrowserSession(browser, testInfo);
    const mentor = await mentorSession.newPage();
    const mentee = await menteeSession.newPage();

    // Routes the mentee's chat socket through the test so the connection can be cut.
    let online = true;
    let current: { page: WebSocketRoute; server: WebSocketRoute } | null = null;
    await mentee.routeWebSocket(/\/socket\.io\//, async (ws) => {
      if (!online) {
        await ws.close();
        return;
      }
      current = { page: ws, server: ws.connectToServer() };
    });

    await signIn(mentee, 'neha@demo.test');
    await chatLink(mentee, groupName).click();
    await signIn(mentor, 'kavya@demo.test');
    await chatLink(mentor, groupName).click();
    const retracted = 'Posting the wrong link here';
    await sendMessage(mentor, retracted);
    await expect(messageLog(mentee).getByText(retracted)).toBeVisible();

    online = false;
    const connection = current as { page: WebSocketRoute; server: WebSocketRoute } | null;
    await connection?.server.close();
    await connection?.page.close();
    await expect(mentee.getByRole('status').filter({ hasText: 'Reconnecting' })).toBeVisible();

    const missed = 'Sent while you were offline';
    await sendMessage(mentor, missed);
    await expect(messageLog(mentor).getByText(missed)).toBeVisible();
    await expect(messageLog(mentee).getByText(missed)).toHaveCount(0);

    // Deleted while the mentee is offline: it must not stay visible after they reconnect.
    await messageLog(mentor)
      .locator('[data-message-id]')
      .filter({ hasText: retracted })
      .getByRole('button', { name: 'Message actions' })
      .click();
    await mentor.getByRole('menuitem', { name: 'Delete for everyone' }).click();
    await mentor
      .getByRole('dialog', { name: 'Delete message?' })
      .getByRole('button', { name: 'Delete for everyone' })
      .click();
    await expect(messageLog(mentor).getByText(retracted)).toHaveCount(0);

    online = true;
    await expect(messageLog(mentee).getByText(missed)).toBeVisible({ timeout: 20_000 });
    await expect(messageLog(mentee).getByText(retracted)).toHaveCount(0);
    await expect(messageLog(mentee).getByText('This message was deleted')).toBeVisible();
    await expect(mentee.getByRole('status').filter({ hasText: 'Reconnecting' })).toHaveCount(0);

    await mentorSession.close();
    await menteeSession.close();
  });
});
