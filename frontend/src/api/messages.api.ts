import { MessagePage } from '../types/message';
import { api } from './client';

export async function fetchMessages(
  conversationId: string,
  query: { before?: string; after?: string; limit?: number } = {},
): Promise<MessagePage> {
  const { data } = await api.get<MessagePage>(`/conversations/${conversationId}/messages`, {
    params: query,
  });
  return data;
}

/** Matches anywhere in the conversation's history, newest first, 20 at a time. */
export async function searchMessages(
  conversationId: string,
  q: string,
  before?: string,
): Promise<MessagePage> {
  const { data } = await api.get<MessagePage>(`/conversations/${conversationId}/messages/search`, {
    params: { q, before },
  });
  return data;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await api.post(`/conversations/${conversationId}/read`);
}
