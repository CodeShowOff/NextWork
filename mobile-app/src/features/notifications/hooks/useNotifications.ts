import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../../shared/api/notifications.api';
import { useNotificationBadgeStore } from '../notification-badge.store';
import { PaginatedNotifications } from '../types';
import { notificationsKeys } from './keys';
import { applyNotificationReadEvent, mergeIncomingNotification } from './notifications-pagination';

const pageSize = 20;

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
