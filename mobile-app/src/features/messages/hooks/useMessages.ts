import { InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { Message, MessageAttachmentLifecycleEvent, MessageReactionUpdatedEvent, PaginatedResponse } from '../types';
import { listMessages, markRead } from '../../../shared/api/messages.api';
import {
  connectMessagesSocket,
  disconnectMessagesSocket,
  getMessagesSocket,
} from '../../../shared/realtime/messages.socket';
import { useSessionStore } from '../../../shared/session/session.store';
import { messagesKeys } from './keys';
import { applyEditedMessage, pushMessage } from './messages-pagination.helpers';

const pageSize = 30;

export function useMessages(conversationId: string) {
  const queryClient = useQueryClient();
  const currentUserId = useSessionStore((state) => state.userId);
  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const processedAttachmentEventIdsRef = useRef<Set<string>>(new Set());
  const processedReactionEventIdsRef = useRef<Set<string>>(new Set());
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

    const onMessageEdited = (message: Message) => {
      if (message.conversationId !== conversationId) {
        return;
      }

      queryClient.setQueryData<InfiniteData<PaginatedResponse<Message>>>(
        messagesKeys.conversationMessages(conversationId),
        (current) => applyEditedMessage(current, message),
      );
    };

    const onAttachmentUploaded = (event: MessageAttachmentLifecycleEvent) => {
      if (event.conversationId !== conversationId || !event.eventId) {
        return;
      }

      if (processedAttachmentEventIdsRef.current.has(event.eventId)) {
        return;
      }
      processedAttachmentEventIdsRef.current.add(event.eventId);

      if (!event.messageId || !event.attachments?.length) {
        return;
      }

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
              items: page.items.map((item) =>
                item.id === event.messageId
                  ? {
                      ...item,
                      attachments: event.attachments ?? item.attachments,
                    }
                  : item,
              ),
            })),
          };
        },
      );
    };

    const onAttachmentFailed = (event: MessageAttachmentLifecycleEvent) => {
      if (event.conversationId !== conversationId || !event.eventId) {
        return;
      }

      if (processedAttachmentEventIdsRef.current.has(event.eventId)) {
        return;
      }

      processedAttachmentEventIdsRef.current.add(event.eventId);
    };

    const onReactionUpdated = (event: MessageReactionUpdatedEvent) => {
      if (event.conversationId !== conversationId || !event.eventId) {
        return;
      }

      if (processedReactionEventIdsRef.current.has(event.eventId)) {
        return;
      }

      processedReactionEventIdsRef.current.add(event.eventId);

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
              items: page.items.map((item) => {
                if (item.id !== event.messageId) {
                  return item;
                }

                const previousMine = item.reactions.find((reaction) => reaction.reactedByMe)?.reactionType;
                const serverMine = event.reactions.find((reaction) =>
                  reaction.reactionType === previousMine,
                )?.reactionType;

                return {
                  ...item,
                  reactions: event.reactions.map((reaction) => ({
                    reactionType: reaction.reactionType,
                    count: reaction.count,
                    reactedByMe: serverMine === reaction.reactionType,
                  })),
                };
              }),
            })),
          };
        },
      );
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
    socket.on('message.edited', onMessageEdited);
    socket.on('message.read', onRead);
    socket.on('conversation.read', onRead);
    socket.on('typing.start', onTypingStart);
    socket.on('typing.stop', onTypingStop);
    socket.on('message.attachment.uploaded', onAttachmentUploaded);
    socket.on('message.attachment.failed', onAttachmentFailed);
    socket.on('message.reaction.updated', onReactionUpdated);

    return () => {
      socket.emit('leave_conversation', { conversationId });
      socket.off('message.new', onNewMessage);
      socket.off('message.edited', onMessageEdited);
      socket.off('message.read', onRead);
      socket.off('conversation.read', onRead);
      socket.off('typing.start', onTypingStart);
      socket.off('typing.stop', onTypingStop);
      socket.off('message.attachment.uploaded', onAttachmentUploaded);
      socket.off('message.attachment.failed', onAttachmentFailed);
      socket.off('message.reaction.updated', onReactionUpdated);
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
