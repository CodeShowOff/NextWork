import {
  MutedNotificationUsersDto,
  NotificationPreferencesDto,
  SendThanksRequestDto,
  UpdateNotificationPreferencesRequestDto,
} from '@workplace/api-contracts';
import {
  MutedNotificationUser,
  NotificationItem,
  NotificationPreferences,
} from '../../features/notifications/types';
import { workplaceApi } from './contracts-client';

type MutedUsersResponse = MutedNotificationUsersDto;
type PreferencesResponse = NotificationPreferencesDto;

export function listNotifications(params: { limit: number; before?: string }) {
  return workplaceApi.notifications.list(params);
}

export function getUnreadNotificationCount() {
  return workplaceApi.notifications.unreadCount();
}

export function markNotificationRead(notificationId: string) {
  return workplaceApi.notifications.markRead(notificationId);
}

export function openNotification(notificationId: string) {
  return workplaceApi.notifications.open(notificationId);
}

export function markAllNotificationsRead() {
  return workplaceApi.notifications.markAllRead();
}

export function getNotificationPreferences() {
  return workplaceApi.notifications.getPreferences() as Promise<PreferencesResponse & NotificationPreferences>;
}

export function updateNotificationPreferences(payload: Partial<NotificationPreferences>) {
  return workplaceApi.notifications.updatePreferences(
    payload as UpdateNotificationPreferencesRequestDto,
  ) as Promise<PreferencesResponse & NotificationPreferences>;
}

export function listMutedNotificationUsers() {
  return workplaceApi.notifications.listMutedUsers() as Promise<MutedUsersResponse & { items: MutedNotificationUser[] }>;
}

export function muteNotificationUser(userId: string) {
  return workplaceApi.notifications.muteUser(userId);
}

export function unmuteNotificationUser(userId: string) {
  return workplaceApi.notifications.unmuteUser(userId);
}

export function sendThanksProfileAction(payload: {
  targetUserId: string;
  messageTemplate?: string;
  notificationType?: 'thanks' | 'thanks-note';
}) {
  return workplaceApi.notifications.sendThanks(payload as SendThanksRequestDto);
}

export type { NotificationItem };
