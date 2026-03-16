import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../../shared/api/notifications.api';
import { useNotificationBadgeStore } from '../notification-badge.store';
import { NotificationItem, NotificationReadEvent, PaginatedNotifications } from '../types';
import { notificationsKeys } from './keys';

const pageSize = 20;

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

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationsKeys.list(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listNotifications({ limit: pageSize, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const decreaseUnread = useNotificationBadgeStore((state) => state.decrease);

  return async (notificationId: string) => {
    const current = queryClient.getQueryData<InfiniteData<PaginatedNotifications>>(notificationsKeys.list());
    const wasUnread =
      current?.pages.some((page) =>
        page.items.some((item) => item.id === notificationId && !item.isRead),
      ) ?? false;

    await markNotificationRead(notificationId);

    queryClient.setQueryData<InfiniteData<PaginatedNotifications>>(notificationsKeys.list(), (current) =>
      applyNotificationReadEvent(current, { notificationId }),
    );
    if (wasUnread) {
      decreaseUnread();
    }
  };
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const resetUnread = useNotificationBadgeStore((state) => state.reset);

  return async () => {
    await markAllNotificationsRead();

    queryClient.setQueryData<InfiniteData<PaginatedNotifications>>(notificationsKeys.list(), (current) =>
      applyNotificationReadEvent(current, { readAll: true }),
    );
    resetUnread();
  };
}
