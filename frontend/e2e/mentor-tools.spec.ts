import { Browser, expect, Page, test, TestInfo } from '@playwright/test';
import { chatLink, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog, sendMessage } from './support/chat';

function bubble(page: Page, text: string) {
  return messageLog(page).locator('[data-message-id]').filter({ hasText: text });
}

async function openActions(page: Page, text: string) {
  await bubble(page, text).getByRole('button', { name: 'Message actions' }).click();
}

/** Priya (mentor) and Rahul (mentee) in their own browsers, both inside a new group. */
async function mentorAndMentee(browser: Browser, testInfo: TestInfo, groupName: string) {
  const mentorSession = await newBrowserSession(browser, testInfo);
  const menteeSession = await newBrowserSession(browser, testInfo);
  const mentor = await mentorSession.newPage();
  const mentee = await menteeSession.newPage();

  await signIn(mentor, 'priya@demo.test');
  await chatLink(mentor, groupName).click();
  await signIn(mentee, 'rahul@demo.test');
  await chatLink(mentee, groupName).click();

  const close = async () => {
    await mentorSession.close();
    await menteeSession.close();
  };
  return { mentor, mentee, close };
}

test.describe('mentor tools', () => {
  test('a mentor posts an announcement and pins it; the mentee sees both live', async ({
    browser,
    request,
  }, testInfo) => {
    const groupName = `Announce ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['priya@demo.test', 'rahul@demo.test']);
    const { mentor, mentee, close } = await mentorAndMentee(browser, testInfo, groupName);

    await expect(mentee.getByRole('button', { name: 'Ask as doubt' })).toBeVisible();
    await expect(mentee.getByRole('button', { name: 'Post as announcement' })).toHaveCount(0);

    const text = 'Mock test this Saturday at 10 AM. Keep your webcam on.';
    await mentor.getByRole('button', { name: 'Post as announcement' }).click();
    await sendMessage(mentor, text);

    await expect(bubble(mentee, text)).toContainText('Announcement');
    await expect(bubble(mentee, text)).toContainText('Priya Sharma');

    await openActions(mentor, text);
    await mentor.getByRole('menuitem', { name: 'Pin to top' }).click();
    await expect(mentor.getByRole('status').filter({ hasText: 'Message pinned' })).toBeVisible();

    await expect(mentee.getByRole('button', { name: /Pinned message/ })).toContainText(text);
    await expect(bubble(mentee, text).getByLabel('Pinned')).toBeVisible();

    await openActions(mentee, text);
    await expect(mentee.getByRole('menuitem', { name: 'Reply' })).toBeVisible();
    await expect(mentee.getByRole('menuitem', { name: 'Pin to top' })).toHaveCount(0);
    await mentee.keyboard.press('Escape');

    await mentee.getByRole('button', { name: 'Group info' }).click();
    await mentee.getByRole('tab', { name: 'Announcements' }).click();
    await expect(mentee.getByRole('tabpanel').getByText(text)).toBeVisible();

    await close();
  });

  test('a mentee asks doubts and the mentor resolves one from the Doubts tab', async ({
    browser,
    request,
  }, testInfo) => {
    const groupName = `Doubts ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['priya@demo.test', 'rahul@demo.test']);
    const { mentor, mentee, close } = await mentorAndMentee(browser, testInfo, groupName);

    const doubt = 'How do I solve time and work problems faster?';
    const doubtToggle = mentee.getByRole('button', { name: 'Ask as doubt' });
    await doubtToggle.click();
    await expect(doubtToggle).toHaveAttribute('aria-pressed', 'true');
    await sendMessage(mentee, doubt);
    await expect(doubtToggle).toHaveAttribute('aria-pressed', 'false');

    await expect(bubble(mentee, doubt)).toContainText('Doubt · open');
    await expect(bubble(mentor, doubt)).toContainText('Doubt · open');

    const later = 'Also, is negative marking applied?';
    await sendMessage(mentee, later);
    await openActions(mentee, later);
    await mentee.getByRole('menuitem', { name: 'Mark as doubt' }).click();
    await expect(bubble(mentor, later)).toContainText('Doubt · open');

    await mentor.getByRole('button', { name: 'Group info' }).click();
    await mentor.getByRole('tab', { name: 'Doubts' }).click();
    const panel = mentor.getByRole('tabpanel');
    await panel
      .getByRole('listitem')
      .filter({ hasText: doubt })
      .getByRole('button', { name: 'Mark resolved' })
      .click();

    await expect(bubble(mentee, doubt)).toContainText('Resolved by Priya Sharma');
    await expect(panel.getByRole('listitem').filter({ hasText: doubt })).toHaveCount(0);
    await expect(panel.getByRole('listitem').filter({ hasText: later })).toBeVisible();

    await panel.getByRole('radio', { name: 'Resolved' }).click();
    await expect(panel.getByRole('listitem').filter({ hasText: doubt })).toContainText(
      'Resolved by Priya Sharma',
    );

    await close();
  });

  test('a reply quotes the original message', async ({ browser, request }, testInfo) => {
    const groupName = `Reply ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['priya@demo.test', 'rahul@demo.test']);
    const { mentor, mentee, close } = await mentorAndMentee(browser, testInfo, groupName);

    const original = 'Please share your resume by Friday evening.';
    await sendMessage(mentor, original);
    await openActions(mentee, original);
    await mentee.getByRole('menuitem', { name: 'Reply' }).click();
    await expect(mentee.getByText('Replying to Priya Sharma')).toBeVisible();

    const reply = 'Sure ma’am, I will send it tonight.';
    await sendMessage(mentee, reply);
    await expect(mentee.getByText('Replying to Priya Sharma')).toHaveCount(0);

    const quote = bubble(mentor, reply).getByRole('button', { name: /Priya Sharma/ });
    await expect(quote).toContainText(original);

    await close();
  });

  test('opening a pinned message far back in the history loads it and scrolls to it', async ({
    page,
  }) => {
    await signIn(page, 'sneha@demo.test');
    await chatLink(page, 'TCS NQT Prep – Batch 12').click();

    const log = messageLog(page);
    const welcome = bubble(page, 'Welcome to TCS NQT Prep');
    await expect(log.locator('[data-message-id]')).toHaveCount(30);
    await expect(welcome).toHaveCount(0);

    await page.getByRole('button', { name: /Pinned message 1 of 2/ }).click();
    const second = page.getByRole('button', { name: /Pinned message 2 of 2/ });
    await expect(second).toContainText('Welcome to TCS NQT Prep');
    await second.click();

    await expect(welcome).toBeInViewport();
    await expect(welcome).toContainText('Announcement');
  });
});
