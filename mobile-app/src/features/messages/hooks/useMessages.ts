import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Message, PaginatedResponse } from '../types';
import { listMessages, markRead } from '../../../shared/api/messages.api';
import {
  connectMessagesSocket,
  disconnectMessagesSocket,
  getMessagesSocket,
} from '../../../shared/realtime/messages.socket';
import { useSessionStore } from '../../../shared/session/session.store';
import { messagesKeys } from './keys';

const pageSize = 30;

function pushMessage(
  data: InfiniteData<PaginatedResponse<Message>> | undefined,
  message: Message,
): InfiniteData<PaginatedResponse<Message>> | undefined {
  if (!data) {
    return data;
  }

  const items = data.pages.flatMap((page) => page.items);
  const exists = items.some((item) => item.id === message.id);
  if (exists) {
    return data;
  }

  const updatedItems = [message, ...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    pageParams: data.pageParams,
    pages: [
      {
        items: updatedItems,
        nextCursor: data.pages[data.pages.length - 1]?.nextCursor ?? null,
      },
    ],
  };
}

export function useMessages(conversationId: string) {
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.userId);
  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [lastReadByOtherMessageId, setLastReadByOtherMessageId] = useState<string | null>(null);
  const messagesQuery = useInfiniteQuery({
    queryKey: messagesKeys.conversationMessages(conversationId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listMessages(conversationId, { limit: pageSize, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    let socket = getMessagesSocket();
    let createdLocalSocket = false;

    if (!socket) {
      socket = connectMessagesSocket({});
      createdLocalSocket = true;
    }

    socket.emit('join_conversation', { conversationId });

    const onNewMessage = (message: Message) => {
      if (message.conversationId !== conversationId) {
        return;
      }

      setTypingUserIds((current) => current.filter((userId) => userId !== message.senderId));

      queryClient.setQueryData<InfiniteData<PaginatedResponse<Message>>>(
        messagesKeys.conversationMessages(conversationId),
        (current) => pushMessage(current, message),
      );

      if (message.senderId !== currentUserId) {
        markRead(conversationId, message.id).catch(() => {
          // Read sync is retried on subsequent updates.
        });
      }
    };

    const onRead = (event: { conversationId: string; userId: string; lastReadMessageId: string }) => {
      if (event.conversationId !== conversationId) {
        return;
      }

      if (event.userId !== currentUserId) {
        setLastReadByOtherMessageId(event.lastReadMessageId);
      }
    };

    const onTypingStart = (event: { conversationId: string; userId: string }) => {
      if (event.conversationId !== conversationId || event.userId === currentUserId) {
        return;
      }

      setTypingUserIds((current) => (current.includes(event.userId) ? current : [...current, event.userId]));
    };

    const onTypingStop = (event: { conversationId: string; userId: string }) => {
      if (event.conversationId !== conversationId) {
        return;
      }

      setTypingUserIds((current) => current.filter((userId) => userId !== event.userId));
    };

    socket.on('message.new', onNewMessage);
    socket.on('message.read', onRead);
    socket.on('conversation.read', onRead);
    socket.on('typing.start', onTypingStart);
    socket.on('typing.stop', onTypingStop);

    return () => {
      socket.emit('leave_conversation', { conversationId });
      socket.off('message.new', onNewMessage);
      socket.off('message.read', onRead);
      socket.off('conversation.read', onRead);
      socket.off('typing.start', onTypingStart);
      socket.off('typing.stop', onTypingStop);
      if (createdLocalSocket) {
        disconnectMessagesSocket();
      }
    };
  }, [conversationId, currentUserId, queryClient]);

  useEffect(() => {
    const newestMessage = messagesQuery.data?.pages[0]?.items[0];
    if (!newestMessage) {
      return;
    }

    if (newestMessage.senderId === currentUserId) {
      return;
    }

    if (lastMarkedMessageIdRef.current === newestMessage.id) {
      return;
    }

    lastMarkedMessageIdRef.current = newestMessage.id;
    markRead(conversationId, newestMessage.id).catch(() => {
      // Ignore transient failures; next fetch or message event will retry.
    });
  }, [conversationId, currentUserId, messagesQuery.data]);

  return {
    ...messagesQuery,
    typingUserIds,
    lastReadByOtherMessageId,
  };
}

export function insertLocalMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: Message,
) {
  queryClient.setQueryData<InfiniteData<PaginatedResponse<Message>>>(
    messagesKeys.conversationMessages(conversationId),
    (current) => pushMessage(current, message),
  );
}

export function removeLocalMessage(
  queryClient: ReturnType<typeof useQueryClient>,
  conversationId: string,
  messageId: string,
) {
  queryClient.setQueryData<InfiniteData<PaginatedResponse<Message>>>(
    messagesKeys.conversationMessages(conversationId),
    (current) => {
      if (!current) {
        return current;
      }

      return {
        pageParams: current.pageParams,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.id !== messageId),
        })),
      };
    },
  );
}
