import { ChatListItem, ConversationDetails } from '../types/conversation';
import { api } from './client';

export async function listConversations(): Promise<ChatListItem[]> {
  const { data } = await api.get<ChatListItem[]>('/conversations');
  return data;
}

export async function getConversation(id: string): Promise<ConversationDetails> {
  const { data } = await api.get<ConversationDetails>(`/conversations/${id}`);
  return data;
}
