import { expect, test } from '@playwright/test';
import { chatLink, signIn } from './support/auth';
import { messageLog } from './support/chat';

test('finds a message older than the loaded history and opens it', async ({ page }) => {
  await signIn(page, 'sneha@demo.test');
  await chatLink(page, 'TCS NQT Prep – Batch 12').click();
  const resources = messageLog(page)
    .locator('[data-message-id]')
    .filter({ hasText: 'Formula sheet' });
  await expect(messageLog(page).locator('[data-message-id]')).toHaveCount(30);
  await expect(resources).toHaveCount(0);

  await page.getByRole('button', { name: 'Search messages' }).click();
  const panel = page.getByRole('complementary', { name: 'Search messages' });
  await panel.getByRole('searchbox', { name: 'Search messages' }).fill('formula');

  const result = panel.getByRole('button', { name: /Priya Sharma/ }).first();
  await expect(result).toContainText('Formula sheet');
  await expect(result.locator('mark')).toHaveText(['Formula', 'formula']);
  await result.click();

  await expect(resources).toBeInViewport();
});
