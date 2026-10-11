import { Message } from '../types/message';
import { api } from './client';

export type DoubtStatus = 'open' | 'resolved';

async function getList(path: string, params?: Record<string, string>): Promise<Message[]> {
  const { data } = await api.get<Message[]>(path, { params });
  return data;
}

export const listPins = (conversationId: string) =>
  getList(`/conversations/${conversationId}/pins`);

export const listDoubts = (conversationId: string, status?: DoubtStatus) =>
  getList(`/conversations/${conversationId}/doubts`, status ? { status } : undefined);

export const listAnnouncements = (conversationId: string) =>
  getList(`/conversations/${conversationId}/announcements`);

async function act(
  method: 'post' | 'put' | 'delete' | 'patch',
  path: string,
  body?: object,
): Promise<Message> {
  const { data } = await api.request<Message>({ method, url: path, data: body });
  return data;
}

export const pinMessage = (id: string) => act('post', `/messages/${id}/pin`);
export const unpinMessage = (id: string) => act('delete', `/messages/${id}/pin`);
export const markDoubt = (id: string) => act('post', `/messages/${id}/doubt`);
export const unmarkDoubt = (id: string) => act('delete', `/messages/${id}/doubt`);
export const setDoubtStatus = (id: string, status: DoubtStatus) =>
  act('patch', `/messages/${id}/doubt`, { status });
export const deleteMessage = (id: string) => act('delete', `/messages/${id}`);
export const editMessage = (id: string, text: string) => act('patch', `/messages/${id}`, { text });

const reactionPath = (id: string, emoji: string) =>
  `/messages/${id}/reactions/${encodeURIComponent(emoji)}`;
export const addReaction = (id: string, emoji: string) => act('put', reactionPath(id, emoji));
export const removeReaction = (id: string, emoji: string) => act('delete', reactionPath(id, emoji));
