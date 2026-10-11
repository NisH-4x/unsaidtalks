import { expect, Page, test } from '@playwright/test';
import { chatLink, signIn } from './support/auth';
import { messageLog } from './support/chat';

// A small phone (iPhone SE size), narrower than the Pixel 7 used by the mobile project.
test.use({ viewport: { width: 375, height: 667 } });

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('small phones', () => {
  test.skip(({ isMobile }) => !isMobile, 'Runs with touch emulation in the mobile project');

  test('mentee screens fit a 375px screen', async ({ page }) => {
    await signIn(page, 'rahul@demo.test');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeInViewport();
    await expectNoSidewaysScroll(page);

    await chatLink(page, 'TCS NQT Prep – Batch 12').click();
    await messageLog(page).locator('[data-message-id]').first().waitFor();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeInViewport();
    await expectNoSidewaysScroll(page);
  });

  test('admin screens fit a 375px screen', async ({ page }) => {
    await signIn(page, 'admin@demo.test');
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeInViewport();

    for (const path of [
      '/admin/groups',
      '/admin/users',
      '/admin/mentor-requests',
      '/admin/reports',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Sign out' })).toBeInViewport();
      await expect(page.getByRole('link', { name: /Reports/ })).toBeInViewport();
      await expectNoSidewaysScroll(page);
    }
  });
});
