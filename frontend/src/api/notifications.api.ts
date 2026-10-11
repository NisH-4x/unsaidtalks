import { NotificationPage } from '../types/notification';
import { api } from './client';

export async function fetchNotifications(before?: string): Promise<NotificationPage> {
  const { data } = await api.get<NotificationPage>('/notifications', {
    params: before ? { before } : undefined,
  });
  return data;
}

/** Marks the given notifications as read, or all of them when no ids are given. */
export async function markNotificationsRead(ids?: string[]): Promise<{ unreadCount: number }> {
  const { data } = await api.post<{ unreadCount: number }>(
    '/notifications/read',
    ids ? { ids } : {},
  );
  return data;
}
