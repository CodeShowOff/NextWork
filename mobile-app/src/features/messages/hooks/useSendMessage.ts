import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendMessage } from '../../../shared/api/messages.api';
import { useSessionStore } from '../../../shared/session/session.store';
import { Message } from '../types';
import { insertLocalMessage, removeLocalMessage } from './useMessages';

function optimisticMessage(conversationId: string, text: string, userId: string): Message {
  const now = new Date().toISOString();
  return {
    id: `optimistic-${Date.now()}`,
    conversationId,
    senderId: userId,
    body: text,
    messageType: 'text',
    createdAt: now,
    editedAt: null,
    sender: {
      id: userId,
      displayName: 'You',
      avatarUrl: null,
    },
  };
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.userId);

  return useMutation({
    mutationFn: async (body: string) => sendMessage(conversationId, { body }),
    onMutate: async (body) => {
      const optimistic = optimisticMessage(conversationId, body, userId);
      insertLocalMessage(queryClient, conversationId, optimistic);
      return { optimisticId: optimistic.id };
    },
    onSuccess: (result, _body, context) => {
      if (context?.optimisticId) {
        removeLocalMessage(queryClient, conversationId, context.optimisticId);
      }
      insertLocalMessage(queryClient, conversationId, result);
    },
    onError: (_error, _body, context) => {
      if (context?.optimisticId) {
        removeLocalMessage(queryClient, conversationId, context.optimisticId);
      }
    },
  });
}
