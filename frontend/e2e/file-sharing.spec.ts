import { Browser, expect, Locator, Page, test, TestInfo } from '@playwright/test';
import path from 'path';
import { chatLink, newBrowserSession, signIn } from './support/auth';
import { createGroup, messageLog } from './support/chat';

const ASSETS = path.resolve(import.meta.dirname, '../../backend/src/database/seed/assets');
const QUESTION_PNG = path.join(ASSETS, 'lis-question.png');
const PRACTICE_PDF = path.join(ASSETS, 'week-1-dp-practice-sheet.pdf');

function bubble(page: Page, text: string) {
  return messageLog(page).locator('[data-message-id]').filter({ hasText: text });
}

async function chooseFile(page: Page, file: string | Parameters<Locator['setInputFiles']>[0]) {
  await page.getByLabel('Choose a file').setInputFiles(file);
}

async function expectImageLoaded(image: Locator) {
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
}

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

test.describe('file sharing', () => {
  test('a mentor shares an image that the mentee sees live and opens full screen', async ({
    browser,
    request,
  }, testInfo) => {
    const groupName = `Images ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['priya@demo.test', 'rahul@demo.test']);
    const { mentor, mentee, close } = await mentorAndMentee(browser, testInfo, groupName);

    await chooseFile(mentor, QUESTION_PNG);
    await expect(mentor.getByText('lis-question.png')).toBeVisible();
    await mentor.getByRole('textbox', { name: 'Message' }).fill('Try this before Friday');
    await mentor.getByRole('button', { name: 'Send message' }).click();

    await expect(
      bubble(mentor, 'Try this before Friday').getByLabel(/^(Sent|Read)$/),
    ).toBeVisible();
    const received = bubble(mentee, 'Try this before Friday');
    await expectImageLoaded(received.getByRole('img', { name: 'lis-question.png' }));

    await received.getByRole('button', { name: 'Open image lis-question.png' }).click();
    const viewer = mentee.getByRole('dialog', { name: 'lis-question.png' });
    await expectImageLoaded(viewer.getByRole('img'));
    await expect(viewer).toContainText('Priya Sharma');
    await mentee.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);

    await close();
  });

  test('a mentee shares a PDF that the mentor downloads', async ({
    browser,
    request,
  }, testInfo) => {
    const groupName = `PDFs ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['priya@demo.test', 'rahul@demo.test']);
    const { mentor, mentee, close } = await mentorAndMentee(browser, testInfo, groupName);

    await chooseFile(mentee, PRACTICE_PDF);
    await mentee.getByRole('button', { name: 'Send message' }).click();

    const card = bubble(mentor, 'week-1-dp-practice-sheet.pdf');
    await expect(card).toContainText(/PDF · \d+ KB/);
    const download = mentor.waitForEvent('download');
    await card.getByRole('button', { name: 'Download week-1-dp-practice-sheet.pdf' }).click();
    expect((await download).suggestedFilename()).toBe('week-1-dp-practice-sheet.pdf');

    await close();
  });

  test('refuses files that are too large or not allowed before uploading', async ({
    page,
    request,
  }, testInfo) => {
    const groupName = `Rejects ${testInfo.project.name} ${Date.now()}`;
    await createGroup(request, groupName, ['priya@demo.test']);
    await signIn(page, 'priya@demo.test');
    await chatLink(page, groupName).click();

    await chooseFile(page, {
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hi'),
    });
    await expect(page.getByRole('alert')).toContainText(
      'Only images (JPEG, PNG, WebP, GIF) and PDF files can be shared.',
    );

    const sixMegabytes = Buffer.alloc(6 * 1024 * 1024);
    await chooseFile(page, { name: 'scan.png', mimeType: 'image/png', buffer: sixMegabytes });
    await expect(
      page.getByRole('alert').filter({ hasText: 'Files can be at most 5 MB.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove attachment' })).toHaveCount(0);
  });

  // Signed in as the group's mentor: groups.spec relies on Rahul's unread count here.
  test('seeded files show up in the program group', async ({ page }) => {
    await signIn(page, 'kavya@demo.test');
    await chatLink(page, 'Infosys SP & DSE – Batch 4').click();

    // Kavya's reply quotes the same text, so pick the bubble that holds the image.
    const image = page.getByRole('img', { name: 'lis-question.png' });
    const doubt = bubble(page, 'my DP is O(n²) and times out').filter({ has: image });
    await expectImageLoaded(doubt.getByRole('img'));
    await expect(doubt).toContainText('Resolved by Kavya Iyer');
    await expect(bubble(page, 'week-1-dp-practice-sheet.pdf')).toContainText('PDF');
  });
});
