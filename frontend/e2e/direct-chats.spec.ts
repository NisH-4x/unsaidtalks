import { expect, test } from '@playwright/test';
import {
  chatLink,
  expectChatList,
  newBrowserSession,
  signIn,
  signUp,
  uniqueEmail,
} from './support/auth';
import {
  createGroup,
  messageLog,
  openDirectChatAs,
  removeFromGroup,
  sendMessage,
} from './support/chat';

test.describe('one-to-one chats', () => {
  test('a mentee starts a chat from "New chat" and the mentor receives it live', async ({
    browser,
  }, testInfo) => {
    const menteeSession = await newBrowserSession(browser, testInfo);
    const mentorSession = await newBrowserSession(browser, testInfo);
    const mentee = await menteeSession.newPage();
    const mentor = await mentorSession.newPage();
    await signIn(mentor, 'arjun@demo.test');
    await expectChatList(mentor);

    await signIn(mentee, 'rahul@demo.test');
    await mentee.getByRole('button', { name: 'New chat' }).click();
    const people = mentee.getByRole('list', { name: 'People you can message' });
    await expect(people.getByText('Arjun Mehta')).toBeVisible();
    await expect(people.getByText('Priya Sharma')).toBeVisible();
    await expect(people.getByText('Sneha Patel')).toHaveCount(0);
    await people.getByText('Arjun Mehta').click();

    await expect(mentee.getByRole('heading', { name: 'Arjun Mehta' })).toBeVisible();
    const text = `Sir, can we review my coding mock? (${testInfo.project.name} ${Date.now()})`;
    await sendMessage(mentee, text);

    await expect(chatLink(mentor, 'Rahul Verma')).toContainText(text);
    await chatLink(mentor, 'Rahul Verma').click();
    await expect(messageLog(mentor).getByText(text)).toBeVisible();

    await menteeSession.close();
    await mentorSession.close();
  });

  test('group info offers "Message" only for people you may message', async ({ page }) => {
    await signIn(page, 'rahul@demo.test');
    await chatLink(page, 'TCS NQT Prep – Batch 12').click();
    await page.getByRole('button', { name: 'Group info' }).click();

    const info = page.getByRole('complementary', { name: 'Group info' });
    await expect(info.getByRole('button', { name: 'Message Priya Sharma' })).toBeVisible();
    await expect(info.getByRole('button', { name: 'Message Arjun Mehta' })).toBeVisible();
    await expect(info.getByRole('button', { name: 'Message Sneha Patel' })).toHaveCount(0);

    await info.getByRole('button', { name: 'Message Priya Sharma' }).click();
    await expect(page.getByRole('heading', { name: 'Priya Sharma' })).toBeVisible();
    await expect(messageLog(page).getByText("Will do. Thank you ma'am!")).toBeVisible();
  });

  test('mentees can message each other only where a group allows it', async ({ page }) => {
    await signIn(page, 'sneha@demo.test');
    await page.getByRole('button', { name: 'New chat' }).click();

    const people = page.getByRole('list', { name: 'People you can message' });
    await expect(people.getByText('Aman Gupta')).toBeVisible();
    // Sneha and Rahul share only TCS NQT Prep, where mentee chats are off.
    await expect(people.getByText('Rahul Verma')).toHaveCount(0);
  });

  test('a chat becomes read-only once the shared group link is removed', async ({
    page,
    request,
  }, testInfo) => {
    const mentee = { email: uniqueEmail('isha', testInfo), password: 'Prepare2026' };
    await signUp(request, { name: 'Isha Rao', ...mentee, role: 'mentee' });
    const groupId = await createGroup(request, `Short course ${Date.now()}`, [
      'kavya@demo.test',
      mentee.email,
    ]);
    await openDirectChatAs(request, mentee, 'kavya@demo.test');
    await removeFromGroup(request, groupId, mentee.email);

    await signIn(page, mentee.email, mentee.password);
    await chatLink(page, 'Kavya Iyer').click();

    await expect(
      page.getByRole('status').filter({ hasText: 'no longer share a program group' }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message' })).toHaveCount(0);
  });
});
