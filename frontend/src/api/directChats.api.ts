import { ContactUser } from '../types/user';
import { api } from './client';

export interface DirectContact extends ContactUser {
  conversationId: string | null;
}

export async function listDirectContacts(query?: string): Promise<DirectContact[]> {
  const { data } = await api.get<DirectContact[]>('/direct-chats/contacts', {
    params: query ? { q: query } : undefined,
  });
  return data;
}

export async function openDirectChat(userId: string): Promise<{ conversationId: string }> {
  const { data } = await api.post<{ conversationId: string }>('/direct-chats', { userId });
  return data;
}
