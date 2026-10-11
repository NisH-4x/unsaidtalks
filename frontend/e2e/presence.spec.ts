import { expect, Page, test } from '@playwright/test';
import { chatLink, expectChatList, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog, sendMessage } from './support/chat';

/** The status line under the conversation title (online, typing…, last seen…). */
function conversationStatus(page: Page) {
  return page.locator('section header p[aria-live]');
}

test.describe('presence and typing', () => {
  test('shows when the other person comes online, types and leaves', async ({
    browser,
  }, testInfo) => {
    const menteeSession = await newBrowserSession(browser, testInfo);
    const mentorSession = await newBrowserSession(browser, testInfo);
    const mentee = await menteeSession.newPage();
    const mentor = await mentorSession.newPage();

    await signIn(mentee, 'aman@demo.test');
    await chatLink(mentee, 'Arjun Mehta').click();
    await expect(conversationStatus(mentee)).not.toHaveText('online');

    await signIn(mentor, 'arjun@demo.test');
    await expectChatList(mentor);
    await expect(conversationStatus(mentee)).toHaveText('online');

    await chatLink(mentor, 'Aman Gupta').click();
    const box = mentor.getByRole('textbox', { name: 'Message' });
    await box.fill('Let me check your mock');
    await expect(conversationStatus(mentee)).toHaveText('typing…');

    await box.fill('');
    await expect(conversationStatus(mentee)).toHaveText('online');

    await mentorSession.close();
    await expect(conversationStatus(mentee)).toHaveText(/^last seen today at /);

    await menteeSession.close();
  });

  test('shows who is typing in a group and clears it when the message arrives', async ({
    browser,
    request,
  }, testInfo) => {
    const groupName = `Typing ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['kavya@demo.test', 'meera@demo.test']);

    const menteeSession = await newBrowserSession(browser, testInfo);
    const mentorSession = await newBrowserSession(browser, testInfo);
    const mentee = await menteeSession.newPage();
    const mentor = await mentorSession.newPage();

    await signIn(mentee, 'meera@demo.test');
    await chatLink(mentee, groupName).click();
    await signIn(mentor, 'kavya@demo.test');
    await chatLink(mentor, groupName).click();
    await expect(conversationStatus(mentee)).toContainText('1 online');

    await mentor.getByRole('textbox', { name: 'Message' }).fill('Mock interview slots');
    await expect(conversationStatus(mentee)).toHaveText('Kavya is typing…');
    if (testInfo.project.name === 'desktop') {
      await expect(chatLink(mentee, groupName)).toContainText('Kavya is typing…');
    }

    await sendMessage(mentor, 'Mock interview slots are open for Friday.');
    await expect(
      messageLog(mentee).getByText('Mock interview slots are open for Friday.'),
    ).toBeVisible();
    await expect(conversationStatus(mentee)).not.toContainText('typing');

    await menteeSession.close();
    await mentorSession.close();
  });
});
