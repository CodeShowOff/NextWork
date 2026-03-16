import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { listConversations } from '../../../shared/api/messages.api';
import { useSessionStore } from '../../../shared/session/session.store';
import { Conversation, PaginatedResponse } from '../types';
import { messagesKeys } from './keys';
import { useMessagesBadgeStore } from '../messages-badge.store';

function totalUnread(items: Conversation[]): number {
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}

async function fetchUnreadSummary(): Promise<number> {
  let before: string | undefined;
  let unread = 0;
  let pageCount = 0;

  while (pageCount < 5) {
    const page = await listConversations({ limit: 50, ...(before ? { before } : {}) });
    unread += totalUnread(page.items);
    pageCount += 1;

    if (!page.nextCursor) {
      break;
    }
    before = page.nextCursor;
  }

  return unread;
}

export function useMessagesBadgeBridge() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.userId);
  const token = useSessionStore((state) => state.accessToken);
  const setUnreadCount = useMessagesBadgeStore((state) => state.setUnreadCount);
  const reset = useMessagesBadgeStore((state) => state.reset);

  const summaryQuery = useQuery({
    queryKey: [...messagesKeys.conversations(), 'unread-summary'],
    queryFn: fetchUnreadSummary,
    enabled: Boolean(userId && token),
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (!userId || !token) {
      reset();
      return;
    }

    if (typeof summaryQuery.data === 'number') {
      setUnreadCount(summaryQuery.data);
    }
  }, [reset, setUnreadCount, summaryQuery.data, token, userId]);

  useEffect(() => {
    if (!userId || !token) {
      return;
    }

    const syncFromCache = () => {
      const cached = queryClient.getQueryData<{ pageParams: unknown[]; pages: PaginatedResponse<Conversation>[] }>(
        messagesKeys.conversations(),
      );
      if (!cached) {
        return;
      }

      const cachedItems = cached.pages.flatMap((page) => page.items);
      setUnreadCount(totalUnread(cachedItems));
    };

    syncFromCache();

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (Array.isArray(key) && key[0] === 'messages' && key[1] === 'conversations') {
        syncFromCache();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, setUnreadCount, token, userId]);
}
