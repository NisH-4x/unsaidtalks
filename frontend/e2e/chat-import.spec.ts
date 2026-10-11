import { expect, test } from '@playwright/test';
import { signIn } from './support/auth';
import { createGroup, messageLog } from './support/chat';

const EXPORT = [
  '01/10/2025, 7:45 pm - Messages and calls are end-to-end encrypted.',
  '01/10/2025, 7:46 pm - Priya Sharma: Welcome to the old WhatsApp group!',
  '02/10/2025, 9:05 am - +91 98765 43210: Is the mock online?',
  '02/10/2025, 9:06 am - Priya Sharma: Yes, on the portal.',
].join('\n');

test('an admin previews and imports a WhatsApp export into a group', async ({
  page,
  request,
}, testInfo) => {
  const group = `Import ${testInfo.project.name} ${Date.now()}`;
  const groupId = await createGroup(request, group, ['priya@demo.test', 'rahul@demo.test']);

  await signIn(page, 'admin@demo.test');
  await page.getByRole('heading', { name: 'Chats', exact: true }).waitFor();
  await page.goto(`/admin/groups/${groupId}`);
  await page.getByRole('button', { name: 'Import WhatsApp chat' }).click();

  const dialog = page.getByRole('dialog', { name: 'Import a WhatsApp chat' });
  await dialog.getByLabel('Exported chat file').setInputFiles({
    name: 'WhatsApp Chat with Batch 12.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(EXPORT),
  });

  await expect(dialog).toContainText('3 messages');
  await expect(dialog.getByLabel('Link Priya Sharma to a member')).toHaveValue(/[0-9a-f]{24}/);
  await expect(dialog.getByLabel('Link WhatsApp contact ending 3210 to a member')).toHaveValue('');
  await expect(dialog).not.toContainText('98765');
  await dialog.getByRole('button', { name: 'Import 3 messages' }).click();

  await expect(dialog).toContainText('3 messages were added to the group');
  await dialog.getByRole('link', { name: 'Open the chat' }).click();

  const log = messageLog(page);
  await expect(log.getByText('Welcome to the old WhatsApp group!')).toBeVisible();
  await expect(
    log.locator('[data-message-id]').filter({ hasText: 'Is the mock online?' }),
  ).toContainText('WhatsApp contact ending 3210');
  await expect(log.getByText('Ananya Rao imported 3 messages from a WhatsApp chat')).toBeVisible();
});
