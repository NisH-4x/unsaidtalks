import { APIRequestContext, expect, Page } from '@playwright/test';
import { DEMO_PASSWORD } from './auth';

export async function apiToken(
  request: APIRequestContext,
  email: string,
  password = DEMO_PASSWORD,
): Promise<Record<string, string>> {
  const response = await request.post('/api/auth/login', { data: { email, password } });
  expect(response.status()).toBe(200);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}` };
}

async function userId(
  request: APIRequestContext,
  adminHeaders: Record<string, string>,
  email: string,
) {
  const response = await request.get('/api/admin/users', {
    headers: adminHeaders,
    params: { q: email },
  });
  const [user] = (await response.json()) as Array<{ id: string }>;
  return user.id;
}

/** Creates a fresh group through the admin API so each test starts with an empty history. */
export async function createGroup(
  request: APIRequestContext,
  name: string,
  memberEmails: string[],
): Promise<string> {
  const headers = await apiToken(request, 'admin@demo.test');
  const memberIds: string[] = [];
  for (const email of memberEmails) memberIds.push(await userId(request, headers, email));

  const created = await request.post('/api/admin/groups', { headers, data: { name, memberIds } });
  expect(created.status()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

export async function removeFromGroup(
  request: APIRequestContext,
  groupId: string,
  email: string,
): Promise<void> {
  const headers = await apiToken(request, 'admin@demo.test');
  const id = await userId(request, headers, email);
  const response = await request.delete(`/api/admin/groups/${groupId}/members/${id}`, { headers });
  expect(response.status()).toBe(200);
}

export async function openDirectChatAs(
  request: APIRequestContext,
  account: { email: string; password: string },
  otherEmail: string,
): Promise<void> {
  const adminHeaders = await apiToken(request, 'admin@demo.test');
  const otherId = await userId(request, adminHeaders, otherEmail);
  const headers = await apiToken(request, account.email, account.password);
  const response = await request.post('/api/direct-chats', { headers, data: { userId: otherId } });
  expect(response.status()).toBeLessThan(300);
}

export function messageLog(page: Page) {
  return page.getByRole('log', { name: 'Messages' });
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Message' }).fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
}
