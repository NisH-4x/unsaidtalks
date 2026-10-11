import { expect, test } from '@playwright/test';
import {
  chatLink,
  expectChatList,
  newBrowserSession,
  signIn,
  signUp,
  uniqueEmail,
} from './support/auth';

test.describe('chat list', () => {
  test('a mentee sees only their own groups and chats', async ({ page }) => {
    await signIn(page, 'rahul@demo.test');
    await expectChatList(page);

    await expect(chatLink(page, 'TCS NQT Prep – Batch 12')).toBeVisible();
    await expect(chatLink(page, 'Infosys SP & DSE – Batch 4')).toBeVisible();
    await expect(chatLink(page, 'Priya Sharma')).toBeVisible();
    await expect(chatLink(page, 'Off-Campus Bootcamp – Batch 7')).toHaveCount(0);
    // No test opens this group as Rahul, so its seeded unread count stays the same.
    await expect(chatLink(page, 'Infosys SP & DSE – Batch 4').getByLabel('2 unread')).toBeVisible();
  });

  test('filters by type and searches by name', async ({ page }) => {
    await signIn(page, 'rahul@demo.test');
    await expectChatList(page);

    await page.getByRole('tab', { name: 'Direct' }).click();
    await expect(chatLink(page, 'Priya Sharma')).toBeVisible();
    await expect(chatLink(page, 'TCS NQT Prep – Batch 12')).toHaveCount(0);

    await page.getByRole('tab', { name: 'All' }).click();
    await page.getByLabel('Search chats').fill('infosys');
    await expect(chatLink(page, 'Infosys SP & DSE – Batch 4')).toBeVisible();
    await expect(chatLink(page, 'Priya Sharma')).toHaveCount(0);
  });

  test('opening a group shows its members without contact details', async ({ page }, testInfo) => {
    await signIn(page, 'rahul@demo.test');
    await chatLink(page, 'TCS NQT Prep – Batch 12').click();

    await expect(page.getByRole('heading', { name: 'TCS NQT Prep – Batch 12' })).toBeVisible();
    await page.getByRole('button', { name: 'Group info' }).click();
    const info = page.getByRole('complementary', { name: 'Group info' });
    await expect(info.getByRole('heading', { name: 'Mentors · 2' })).toBeVisible();
    await expect(info.getByText('Arjun Mehta')).toBeVisible();
    await expect(page.getByText('@demo.test')).toHaveCount(0);
    await info.getByRole('button', { name: 'Close info' }).click();

    // Phones show one pane at a time; wider screens keep the list beside the conversation.
    if (testInfo.project.name === 'mobile') {
      await expect(page.getByRole('heading', { name: 'Chats', exact: true })).toBeHidden();
      await page.getByRole('link', { name: 'Back to chats' }).click();
    }
    await expectChatList(page);
  });
});

test.describe('admin group management', () => {
  test('an admin creates a group, members see it, and removing a member hides it', async ({
    browser,
  }, testInfo) => {
    const groupName = `Placement Sprint ${testInfo.project.name} ${Date.now()}`;
    const adminSession = await newBrowserSession(browser, testInfo);
    const menteeSession = await newBrowserSession(browser, testInfo);
    const admin = await adminSession.newPage();
    const mentee = await menteeSession.newPage();

    await signIn(admin, 'admin@demo.test');
    await expectChatList(admin);
    await admin.getByRole('link', { name: 'Admin' }).click();
    await admin.getByRole('link', { name: 'New group' }).click();

    await admin.getByLabel('Group name').fill(groupName);
    await admin.getByLabel('Program').fill('Placement Sprint');
    await admin.getByLabel('Batch').fill('Batch 1');
    await admin.getByLabel('Search people').fill('Rahul');
    await admin.getByRole('checkbox', { name: /Rahul Verma/ }).click();
    await admin.getByLabel('Search people').fill('Kavya');
    await admin.getByRole('checkbox', { name: /Kavya Iyer/ }).click();
    await admin.getByRole('button', { name: 'Create group with 2 people' }).click();

    await expect(admin.getByText('Group created.')).toBeVisible();
    await expect(admin.getByRole('heading', { name: 'Members · 2' })).toBeVisible();

    await admin.getByRole('switch', { name: 'Allow mentees to message each other' }).click();
    await admin.getByRole('button', { name: 'Save changes' }).click();
    await expect(admin.getByText('Group details saved.')).toBeVisible();

    await signIn(mentee, 'rahul@demo.test');
    const newGroup = chatLink(mentee, groupName);
    await expect(newGroup).toBeVisible();
    await expect(newGroup).toContainText('Ananya Rao added');

    await admin.getByRole('button', { name: 'Remove Rahul Verma' }).click();
    await admin.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(admin.getByText('Rahul Verma was removed from the group.')).toBeVisible();

    await mentee.reload();
    await expectChatList(mentee);
    await expect(chatLink(mentee, groupName)).toHaveCount(0);

    await adminSession.close();
    await menteeSession.close();
  });

  test('a deactivated user is signed out and cannot sign back in', async ({
    browser,
    request,
  }, testInfo) => {
    const email = uniqueEmail('kabir', testInfo);
    const password = 'Prepare2026';
    await signUp(request, { name: 'Kabir Sethi', email, password, role: 'mentee' });

    const userSession = await newBrowserSession(browser, testInfo);
    const adminSession = await newBrowserSession(browser, testInfo);
    const user = await userSession.newPage();
    const admin = await adminSession.newPage();

    await signIn(user, email, password);
    await expectChatList(user);

    await signIn(admin, 'admin@demo.test');
    await expectChatList(admin);
    await admin.goto('/admin/users');
    await admin.getByLabel('Search users').fill(email);
    const row = admin.getByRole('listitem').filter({ hasText: email });
    await row.getByRole('button', { name: 'Deactivate' }).click();
    await row.getByRole('button', { name: 'Yes, deactivate' }).click();
    await expect(admin.getByText('Kabir Sethi has been deactivated')).toBeVisible();

    await user.reload();
    await expect(user).toHaveURL(/\/login$/);
    await signIn(user, email, password);
    await expect(user.getByRole('alert')).toHaveText('This account has been deactivated.');

    await userSession.close();
    await adminSession.close();
  });
});
