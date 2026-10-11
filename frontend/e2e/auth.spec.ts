import { expect, test } from '@playwright/test';
import {
  chatLink,
  expectChatList,
  expectGreeting,
  newBrowserSession,
  signIn,
  signUp,
  uniqueEmail,
} from './support/auth';

test.describe('authentication', () => {
  test('a mentee signs up and lands in the app', async ({ page }, testInfo) => {
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Tara Bose');
    await page.getByLabel('Email').fill(uniqueEmail('tara', testInfo));
    await page.getByLabel('Password', { exact: true }).fill('Prepare2026');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expectGreeting(page, 'Tara');
  });

  test('signup explains invalid input before sending it', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('T');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Enter your full name (2–60 characters)')).toBeVisible();
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByText('Use 8 to 64 characters')).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('a wrong password shows a clear error', async ({ page }) => {
    await signIn(page, 'rahul@demo.test', 'Wrong-password-1');

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('the session survives a page reload', async ({ page }) => {
    await signIn(page, 'rahul@demo.test');
    await expect(chatLink(page, 'TCS NQT Prep – Batch 12')).toBeVisible();

    await page.reload();
    await expect(chatLink(page, 'TCS NQT Prep – Batch 12')).toBeVisible();
  });

  test('signing out ends the session and protects the app', async ({ page }) => {
    await signIn(page, 'priya@demo.test');
    await expectChatList(page);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('a mentee cannot open admin pages', async ({ page }) => {
    await signIn(page, 'rahul@demo.test');
    await expectChatList(page);

    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    await page.goto('/admin/mentor-requests');
    await expect(page.getByRole('heading', { name: "This page isn't for you" })).toBeVisible();
  });
});

test.describe('mentor approval', () => {
  test('a mentor waits for approval, an admin approves, then the mentor signs in', async ({
    browser,
  }, testInfo) => {
    const mentorEmail = uniqueEmail('nikhil', testInfo);
    const mentorPassword = 'Guide2026x';

    const mentorSession = await newBrowserSession(browser, testInfo);
    const adminSession = await newBrowserSession(browser, testInfo);
    const mentor = await mentorSession.newPage();
    const admin = await adminSession.newPage();

    await mentor.goto('/signup');
    await mentor
      .getByRole('group', { name: 'I am joining as' })
      .getByText('Mentor', { exact: true })
      .click();
    await expect(mentor.getByRole('radio', { name: /^Mentor/ })).toBeChecked();
    await mentor.getByLabel('Full name').fill('Nikhil Shah');
    await mentor.getByLabel('Email').fill(mentorEmail);
    await mentor.getByLabel('Password', { exact: true }).fill(mentorPassword);
    await mentor.getByRole('button', { name: 'Request mentor account' }).click();
    await expect(mentor.getByRole('heading', { name: 'Application sent' })).toBeVisible();

    await signIn(mentor, mentorEmail, mentorPassword);
    await expect(mentor.getByRole('status').filter({ hasText: 'Approval pending' })).toBeVisible();

    await signIn(admin, 'admin@demo.test');
    await expectChatList(admin);
    await admin.getByRole('link', { name: 'Admin' }).click();
    await admin.getByRole('link', { name: 'Mentor requests' }).click();
    await expect(admin.getByRole('heading', { name: 'Mentor requests' })).toBeVisible();

    const row = admin.getByRole('listitem').filter({ hasText: mentorEmail });
    await row.getByRole('button', { name: 'Approve' }).click();
    await expect(admin.getByText('Nikhil Shah is now a mentor and can sign in.')).toBeVisible();
    await expect(row).toHaveCount(0);

    await mentor.getByRole('button', { name: 'Sign in' }).click();
    await expectGreeting(mentor, 'Nikhil');

    await mentorSession.close();
    await adminSession.close();
  });

  test('an admin can decline a request', async ({ page, request }, testInfo) => {
    const applicantEmail = uniqueEmail('meghna', testInfo);
    await signUp(request, {
      name: 'Meghna Iyer',
      email: applicantEmail,
      password: 'Guide2026x',
      role: 'mentor',
    });

    await signIn(page, 'admin@demo.test');
    await expectChatList(page);
    await page.goto('/admin/mentor-requests');

    const row = page.getByRole('listitem').filter({ hasText: applicantEmail });
    await row.getByRole('button', { name: 'Reject' }).click();
    await row.getByRole('button', { name: 'Decline' }).click();

    await expect(page.getByText("Meghna Iyer's request was declined.")).toBeVisible();
    await expect(row).toHaveCount(0);
  });
});
