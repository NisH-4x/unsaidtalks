import { expect, test } from '@playwright/test';
import { chatLink, signIn } from './support/auth';
import { apiToken, messageLog } from './support/chat';

const GROUP = 'TCS NQT Prep – Batch 12';

// The summary request is answered in the browser: browser tests never call the real AI service.
test('mentors see a clearly labelled AI summary of open doubts that links to each doubt', async ({
  page,
  request,
}) => {
  const headers = await apiToken(request, 'priya@demo.test');
  const chats = (await (await request.get('/api/conversations', { headers })).json()) as Array<{
    id: string;
    title: string;
  }>;
  const groupId = chats.find((chat) => chat.title === GROUP)!.id;
  const doubts = (await (
    await request.get(`/api/conversations/${groupId}/doubts?status=open`, { headers })
  ).json()) as Array<{ id: string; text: string; sender: { name: string } }>;
  const [first] = doubts;

  await page.route('**/doubts/summary', (route) =>
    route.fulfill({
      json: {
        status: 'ready',
        doubtCount: doubts.length,
        omittedCount: 0,
        overview: 'Students are stuck on a few aptitude and coding questions.',
        topics: [
          {
            title: 'A question worth answering first',
            summary: 'Asked recently and not answered yet.',
            doubts: [
              {
                messageId: first.id,
                askedBy: first.sender.name,
                askedAt: new Date().toISOString(),
                preview: first.text,
              },
            ],
          },
        ],
        generatedAt: new Date().toISOString(),
        model: 'openai/gpt-oss-120b',
      },
    }),
  );

  await signIn(page, 'priya@demo.test');
  await chatLink(page, GROUP).click();
  // One click from the header opens the Doubts tab and starts the summary.
  await page.getByRole('button', { name: 'AI summary of open doubts' }).click();
  await expect(page.getByRole('tab', { name: 'Doubts' })).toHaveAttribute('aria-selected', 'true');
  const card = page.getByRole('region', { name: 'AI summary of open doubts' });

  await expect(card).toContainText('AI-generated and may be inaccurate');
  await expect(card).toContainText('A question worth answering first');
  await expect(card).toContainText(`Based on ${doubts.length} open doubts`);
  await card.getByRole('button', { name: 'Go to doubt' }).click();
  await expect(messageLog(page).locator(`[data-message-id="${first.id}"]`)).toBeInViewport();
});

test('the summary can also be started from the Doubts tab, and failures explain themselves', async ({
  page,
}) => {
  await page.route('**/doubts/summary', (route) =>
    route.fulfill({
      status: 503,
      json: { statusCode: 503, message: 'AI summaries are not set up on this server.' },
    }),
  );

  await signIn(page, 'arjun@demo.test');
  await chatLink(page, GROUP).click();
  await page.getByRole('button', { name: 'Group info' }).click();
  await page.getByRole('tab', { name: 'Doubts' }).click();
  const card = page.getByRole('region', { name: 'AI summary of open doubts' });
  await card.getByRole('button', { name: 'Summarise open doubts' }).click();

  await expect(card.getByRole('alert')).toHaveText('AI summaries are not set up on this server.');
  await expect(card.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('mentees do not get the AI summary', async ({ page }) => {
  await signIn(page, 'sneha@demo.test');
  await chatLink(page, GROUP).click();
  await page.getByRole('button', { name: 'Group info' }).click();
  await page.getByRole('tab', { name: 'Doubts' }).click();
  await expect(page.getByRole('radio', { name: 'Open' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'AI summary of open doubts' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'AI summary of open doubts' })).toHaveCount(0);
});
