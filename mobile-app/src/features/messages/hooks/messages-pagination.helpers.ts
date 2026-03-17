import { InfiniteData } from '@tanstack/react-query';

import { Message, PaginatedResponse } from '../types';

export function pushMessage(
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

export function applyEditedMessage(
  data: InfiniteData<PaginatedResponse<Message>> | undefined,
  message: Message,
): InfiniteData<PaginatedResponse<Message>> | undefined {
  if (!data) {
    return data;
  }

  return {
    pageParams: data.pageParams,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === message.id ? { ...item, ...message } : item)),
    })),
  };
}
