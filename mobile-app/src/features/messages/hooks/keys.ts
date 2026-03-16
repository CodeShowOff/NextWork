export const messagesKeys = {
  all: ['messages'] as const,
  conversations: () => [...messagesKeys.all, 'conversations'] as const,
  conversationMessages: (conversationId: string) =>
    [...messagesKeys.all, 'conversation', conversationId, 'items'] as const,
};
