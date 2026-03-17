import { InfiniteData } from '@tanstack/react-query';

jest.mock('react-native', () => ({
  Platform: {
    select: (value: Record<string, string>) => value.default ?? 'localhost',
  },
}));

import { mergeConversation } from './useConversations';
import { Conversation, PaginatedResponse } from '../types';

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'c1',
    type: 'direct',
    createdAt: '2026-03-17T09:00:00.000Z',
    participants: [
      {
        userId: 'u1',
        displayName: 'User One',
        avatarUrl: null,
        role: 'member',
      },
      {
        userId: 'u2',
        displayName: 'User Two',
        avatarUrl: null,
        role: 'member',
      },
    ],
    lastMessage: {
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u2',
      body: 'Hello',
      messageType: 'text',
      attachments: [],
      reactions: [],
      createdAt: '2026-03-17T09:00:00.000Z',
      editedAt: null,
      sender: {
        id: 'u2',
        displayName: 'User Two',
        avatarUrl: null,
      },
    },
    unreadCount: 0,
    ...overrides,
  };
}

function baseData(): InfiniteData<PaginatedResponse<Conversation>> {
  return {
    pageParams: [undefined],
    pages: [
      {
        items: [conversation()],
        nextCursor: 'cursor-2',
      },
    ],
  };
}

describe('conversation pagination helper', () => {
  it('updates existing conversation and keeps pagination cursor stable', () => {
    const current = baseData();
    const incoming = conversation({
      id: 'c1',
      unreadCount: 3,
      lastMessage: {
        ...conversation().lastMessage!,
        id: 'm2',
        body: 'Updated',
        createdAt: '2026-03-17T09:10:00.000Z',
      },
    });

    const next = mergeConversation(current, incoming);

    expect(next?.pages[0].items[0].id).toBe('c1');
    expect(next?.pages[0].items[0].lastMessage?.id).toBe('m2');
    expect(next?.pages[0].items[0].unreadCount).toBe(3);
    expect(next?.pages[0].nextCursor).toBe('cursor-2');
  });

  it('inserts new conversation and sorts by latest message timestamp', () => {
    const current = baseData();
    const incoming = conversation({
      id: 'c2',
      createdAt: '2026-03-17T10:00:00.000Z',
      lastMessage: {
        ...conversation().lastMessage!,
        id: 'm3',
        conversationId: 'c2',
        createdAt: '2026-03-17T10:00:00.000Z',
      },
    });

    const next = mergeConversation(current, incoming);

    expect(next?.pages[0].items.map((item) => item.id)).toEqual(['c2', 'c1']);
    expect(next?.pages[0].nextCursor).toBe('cursor-2');
  });
});
