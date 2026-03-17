import { InfiniteData } from '@tanstack/react-query';

import { applyNotificationReadEvent, mergeIncomingNotification } from './notifications-pagination';
import { NotificationItem, PaginatedNotifications } from '../types';

function buildNotificationsData(): InfiniteData<PaginatedNotifications> {
  const baseItem: NotificationItem = {
    id: 'n1',
    userId: 'u1',
    actorId: 'u2',
    type: 'like',
    entityType: 'post',
    entityId: 'p1',
    isRead: false,
    createdAt: '2026-03-17T10:00:00.000Z',
    actor: {
      id: 'u2',
      displayName: 'User Two',
      avatarUrl: null,
    },
  };

  return {
    pageParams: [undefined],
    pages: [
      {
        items: [baseItem],
        nextCursor: 'cursor-2',
      },
    ],
  };
}

describe('notifications pagination helpers', () => {
  it('inserts incoming notification in chronological order and keeps next cursor', () => {
    const current = buildNotificationsData();
    const incoming: NotificationItem = {
      ...current.pages[0].items[0],
      id: 'n2',
      createdAt: '2026-03-17T10:05:00.000Z',
    };

    const next = mergeIncomingNotification(current, incoming);

    expect(next?.pages[0].items.map((item) => item.id)).toEqual(['n2', 'n1']);
    expect(next?.pages[0].nextCursor).toBe('cursor-2');
  });

  it('marks one notification as read without changing others', () => {
    const current = buildNotificationsData();
    const unread: NotificationItem = {
      ...current.pages[0].items[0],
      id: 'n2',
      isRead: false,
      createdAt: '2026-03-17T10:05:00.000Z',
    };

    const withTwo: InfiniteData<PaginatedNotifications> = {
      pageParams: current.pageParams,
      pages: [{ ...current.pages[0], items: [unread, ...current.pages[0].items] }],
    };

    const next = applyNotificationReadEvent(withTwo, { notificationId: 'n2' });

    expect(next?.pages[0].items.find((item) => item.id === 'n2')?.isRead).toBe(true);
    expect(next?.pages[0].items.find((item) => item.id === 'n1')?.isRead).toBe(false);
  });
});
