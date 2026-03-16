import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getUnreadNotificationCount } from '../../../shared/api/notifications.api';
import {
  connectNotificationsSocket,
  disconnectNotificationsSocket,
} from '../../../shared/realtime/notifications.socket';
import { useSessionStore } from '../../../shared/session/session.store';
import { useNotificationBadgeStore } from '../notification-badge.store';
import { PaginatedNotifications } from '../types';
import { notificationsKeys } from './keys';
import { applyNotificationReadEvent, mergeIncomingNotification } from './useNotifications';

export function useNotificationBadgeBridge() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.userId);
  const token = useSessionStore((state) => state.accessToken);
  const setUnread = useNotificationBadgeStore((state) => state.setUnreadCount);
  const increase = useNotificationBadgeStore((state) => state.increase);
  const decrease = useNotificationBadgeStore((state) => state.decrease);
  const reset = useNotificationBadgeStore((state) => state.reset);

  useEffect(() => {
    if (!userId || !token) {
      reset();
      disconnectNotificationsSocket();
      return;
    }

    getUnreadNotificationCount()
      .then((result) => {
        setUnread(result.unreadCount);
      })
      .catch(() => {
        // Fail silently and let live events resync badge.
      });

    const socket = connectNotificationsSocket({
      onNew: (notification) => {
        queryClient.setQueryData<InfiniteData<PaginatedNotifications>>(notificationsKeys.list(), (current) =>
          mergeIncomingNotification(current, notification),
        );
        increase();
      },
      onRead: (event) => {
        queryClient.setQueryData<InfiniteData<PaginatedNotifications>>(notificationsKeys.list(), (current) =>
          applyNotificationReadEvent(current, event),
        );

        if (event.readAll) {
          reset();
        } else if (event.notificationId) {
          decrease();
        }
      },
    });

    return () => {
      socket.removeAllListeners();
      disconnectNotificationsSocket();
    };
  }, [decrease, increase, queryClient, reset, setUnread, token, userId]);
}
