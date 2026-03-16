import {
  MutedNotificationUser,
  NotificationItem,
  NotificationPreferences,
  PaginatedNotifications,
} from '../../features/notifications/types';
import { requestJson } from './http';

export function listNotifications(params: { limit: number; before?: string }) {
  const search = new URLSearchParams({ limit: String(params.limit) });
  if (params.before) {
    search.set('before', params.before);
  }

  return requestJson<PaginatedNotifications>(`/notifications?${search.toString()}`);
}

export function getUnreadNotificationCount() {
  return requestJson<{ unreadCount: number }>('/notifications/unread-count');
}

export function markNotificationRead(notificationId: string) {
  return requestJson<{ status: 'ok' }>(`/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export function markAllNotificationsRead() {
  return requestJson<{ status: 'ok'; updated: number }>('/notifications/read-all', {
    method: 'POST',
  });
}

export function getNotificationPreferences() {
  return requestJson<NotificationPreferences>('/notifications/preferences');
}

export function updateNotificationPreferences(payload: Partial<NotificationPreferences>) {
  return requestJson<NotificationPreferences>('/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function listMutedNotificationUsers() {
  return requestJson<{ items: MutedNotificationUser[] }>('/notifications/muted-users');
}

export function muteNotificationUser(userId: string) {
  return requestJson<{ status: 'ok' }>(`/notifications/muted-users/${userId}`, {
    method: 'POST',
  });
}

export function unmuteNotificationUser(userId: string) {
  return requestJson<{ status: 'ok' }>(`/notifications/muted-users/${userId}`, {
    method: 'DELETE',
  });
}

export type { NotificationItem };
