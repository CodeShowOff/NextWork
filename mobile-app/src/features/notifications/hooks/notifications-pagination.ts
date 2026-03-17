import { InfiniteData } from '@tanstack/react-query';

import { NotificationItem, NotificationReadEvent, PaginatedNotifications } from '../types';

export function mergeIncomingNotification(
  data: InfiniteData<PaginatedNotifications> | undefined,
  notification: NotificationItem,
): InfiniteData<PaginatedNotifications> | undefined {
  if (!data) {
    return data;
  }

  const all = data.pages.flatMap((page) => page.items);
  const exists = all.some((item) => item.id === notification.id);
  if (exists) {
    return data;
  }

  const items = [notification, ...all].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    pageParams: data.pageParams,
    pages: [
      {
        items,
        nextCursor: data.pages[data.pages.length - 1]?.nextCursor ?? null,
      },
    ],
  };
}

export function applyNotificationReadEvent(
  data: InfiniteData<PaginatedNotifications> | undefined,
  event: NotificationReadEvent,
): InfiniteData<PaginatedNotifications> | undefined {
  if (!data) {
    return data;
  }

  if (event.readAll) {
    return {
      pageParams: data.pageParams,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => ({ ...item, isRead: true })),
      })),
    };
  }

  if (!event.notificationId) {
    return data;
  }

  return {
    pageParams: data.pageParams,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.id === event.notificationId ? { ...item, isRead: true } : item,
      ),
    })),
  };
}
