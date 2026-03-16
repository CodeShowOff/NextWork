import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { Conversation, ConversationMessageEvent, MessageReadEvent, PaginatedResponse } from '../types';
import { listConversations } from '../../../shared/api/messages.api';
import { connectMessagesSocket } from '../../../shared/realtime/messages.socket';
import { useSessionStore } from '../../../shared/session/session.store';
import { messagesKeys } from './keys';

const pageSize = 20;

function mergeConversation(
  data: InfiniteData<PaginatedResponse<Conversation>> | undefined,
  incoming: Conversation,
): InfiniteData<PaginatedResponse<Conversation>> | undefined {
  if (!data) {
    return data;
  }

  const all = data.pages.flatMap((page) => page.items);
  const exists = all.some((conversation) => conversation.id === incoming.id);

  const updated = exists
    ? all.map((conversation) => (conversation.id === incoming.id ? incoming : conversation))
    : [incoming, ...all];

  updated.sort((a, b) => {
    const aDate = a.lastMessage?.createdAt ?? a.createdAt;
    const bDate = b.lastMessage?.createdAt ?? b.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return {
    pageParams: data.pageParams,
    pages: [
      {
        items: updated,
        nextCursor: data.pages[data.pages.length - 1]?.nextCursor ?? null,
      },
    ],
  };
}

function applyIncomingMessage(
  data: InfiniteData<PaginatedResponse<Conversation>> | undefined,
  event: ConversationMessageEvent,
  currentUserId: string,
): InfiniteData<PaginatedResponse<Conversation>> | undefined {
  if (!data) {
    return data;
  }

  const all = data.pages.flatMap((page) => page.items);
  const target = all.find((conversation) => conversation.id === event.conversationId);

  if (!target) {
    return data;
  }

  const updatedConversation: Conversation = {
    ...target,
    lastMessage: event.message,
    unreadCount: event.message.senderId === currentUserId ? target.unreadCount : target.unreadCount + 1,
  };

  return mergeConversation(data, updatedConversation);
}

function applyReadEvent(
  data: InfiniteData<PaginatedResponse<Conversation>> | undefined,
  event: MessageReadEvent,
  currentUserId: string,
): InfiniteData<PaginatedResponse<Conversation>> | undefined {
  if (!data) {
    return data;
  }

  const all = data.pages.flatMap((page) => page.items);
  const target = all.find((conversation) => conversation.id === event.conversationId);

  if (!target) {
    return data;
  }

  const updatedConversation: Conversation = {
    ...target,
    unreadCount: event.userId === currentUserId ? 0 : target.unreadCount,
  };

  return mergeConversation(data, updatedConversation);
}

export function useConversations() {
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.userId);

  useEffect(() => {
    const onConversationMessage = (event: ConversationMessageEvent) => {
        queryClient.setQueryData<InfiniteData<PaginatedResponse<Conversation>>>(
          messagesKeys.conversations(),
          (current) => applyIncomingMessage(current, event, currentUserId),
        );
      };

    const onRead = (event: MessageReadEvent) => {
        queryClient.setQueryData<InfiniteData<PaginatedResponse<Conversation>>>(
          messagesKeys.conversations(),
          (current) => applyReadEvent(current, event, currentUserId),
        );
      };

    const socket = connectMessagesSocket({
      onConversationMessage,
      onRead,
    });

    return () => {
      socket.off('conversation.message', onConversationMessage);
      socket.off('message.read', onRead);
      socket.off('conversation.read', onRead);
    };
  }, [currentUserId, queryClient]);

  return useInfiniteQuery({
    queryKey: messagesKeys.conversations(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listConversations({ limit: pageSize, before: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function upsertConversation(queryClient: ReturnType<typeof useQueryClient>, conversation: Conversation) {
  queryClient.setQueryData<InfiniteData<PaginatedResponse<Conversation>>>(
    messagesKeys.conversations(),
    (current) => mergeConversation(current, conversation),
  );
}
