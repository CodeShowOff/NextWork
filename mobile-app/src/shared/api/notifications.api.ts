import {
  MutedNotificationUsersDto,
  NotificationPreferencesDto,
  SendThanksRequestDto,
  UpdateNotificationPreferencesRequestDto,
} from '@nextwork/api-contracts';
import {
  MutedNotificationUser,
  NotificationItem,
  NotificationPreferences,
} from '../../features/notifications/types';
import { nextworkApi } from './contracts-client';
import { requestJson } from './http';

type MutedUsersResponse = MutedNotificationUsersDto;
type PreferencesResponse = NotificationPreferencesDto;

export function listNotifications(params: { limit: number; before?: string }) {
  return nextworkApi.notifications.list(params);
}

export function getUnreadNotificationCount() {
  return nextworkApi.notifications.unreadCount();
}

export function markNotificationRead(notificationId: string) {
  return nextworkApi.notifications.markRead(notificationId);
}

export function openNotification(notificationId: string) {
  return nextworkApi.notifications.open(notificationId);
}

export function markAllNotificationsRead() {
  return nextworkApi.notifications.markAllRead();
}

export function getNotificationPreferences() {
  return nextworkApi.notifications.getPreferences() as Promise<PreferencesResponse & NotificationPreferences>;
}

export function updateNotificationPreferences(payload: Partial<NotificationPreferences>) {
  return nextworkApi.notifications.updatePreferences(
    payload as UpdateNotificationPreferencesRequestDto,
  ) as Promise<PreferencesResponse & NotificationPreferences>;
}

export function listMutedNotificationUsers() {
  return nextworkApi.notifications.listMutedUsers() as Promise<MutedUsersResponse & { items: MutedNotificationUser[] }>;
}

export function muteNotificationUser(userId: string) {
  return nextworkApi.notifications.muteUser(userId);
}

export function unmuteNotificationUser(userId: string) {
  return nextworkApi.notifications.unmuteUser(userId);
}

export function sendThanksProfileAction(payload: {
  targetUserId: string;
  messageTemplate?: string;
  notificationType?: 'thanks' | 'thanks-note';
}) {
  return nextworkApi.notifications.sendThanks(payload as SendThanksRequestDto);
}

export function registerNotificationDevice(payload: { platform: 'ios' | 'android' | 'web'; token: string }) {
  return requestJson<{ status: 'ok'; deviceToken: { id: string; platform: string; token: string; lastSeenAt: string } }>('/notifications/device-tokens/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function heartbeatNotificationDevice(payload: { token: string; platform: 'ios' | 'android' | 'web' }) {
  return requestJson<{ status: 'ok'; found: boolean }>('/notifications/device-tokens/heartbeat', { method: 'POST', body: JSON.stringify(payload) });
}

export function unregisterNotificationDevice(payload: { token: string; platform: 'ios' | 'android' | 'web' }) {
  return requestJson<{ status: 'ok'; removed: boolean }>('/notifications/device-tokens/unregister', { method: 'POST', body: JSON.stringify(payload) });
}

export type { NotificationItem };
