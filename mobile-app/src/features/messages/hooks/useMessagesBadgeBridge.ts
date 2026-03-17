import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getUnreadMessagesCount } from '../../../shared/api/messages.api';
import { connectMessagesSocket, disconnectMessagesSocket } from '../../../shared/realtime/messages.socket';
import { useSessionStore } from '../../../shared/session/session.store';
import { Conversation, PaginatedResponse } from '../types';
import { messagesKeys } from './keys';
import { useMessagesBadgeStore } from '../messages-badge.store';

function totalUnread(items: Conversation[]): number {
  return items.reduce((sum, item) => sum + item.unreadCount, 0);
}

export function useMessagesBadgeBridge() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.userId);
  const token = useSessionStore((state) => state.accessToken);
  const setUnreadCount = useMessagesBadgeStore((state) => state.setUnreadCount);
  const reset = useMessagesBadgeStore((state) => state.reset);

  useEffect(() => {
    if (!userId || !token) {
      return;
    }

    let isCancelled = false;
    const syncUnread = async () => {
      try {
        const result = await getUnreadMessagesCount();
        if (!isCancelled) {
          setUnreadCount(result.unreadCount);
        }
      } catch {
        // Keep current count and retry on next interval/event.
      }
    };

    void syncUnread();
    const intervalId = setInterval(syncUnread, 20000);

    const onConversationMessage = () => {
      void syncUnread();
    };
    const onRead = () => {
      void syncUnread();
    };

    const socket = connectMessagesSocket({
      onConversationMessage,
      onRead,
    });

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
      socket.off('conversation.message', onConversationMessage);
      socket.off('message.read', onRead);
      socket.off('conversation.read', onRead);
    };
  }, [setUnreadCount, token, userId]);

  useEffect(() => {
    if (!userId || !token) {
      reset();
      disconnectMessagesSocket();
      return;
    }
  }, [reset, token, userId]);

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
