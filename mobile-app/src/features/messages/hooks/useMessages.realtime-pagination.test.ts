import { InfiniteData } from '@tanstack/react-query';

import { pushMessage, applyEditedMessage } from './messages-pagination.helpers';
import { Message, PaginatedResponse } from '../types';

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'u1',
    body: 'Hello',
    messageType: 'text',
    attachments: [],
    reactions: [],
    createdAt: '2026-03-17T09:00:00.000Z',
    editedAt: null,
    sender: {
      id: 'u1',
      displayName: 'User One',
      avatarUrl: null,
    },
    ...overrides,
  };
}

function baseData(): InfiniteData<PaginatedResponse<Message>> {
  return {
    pageParams: [undefined],
    pages: [
      {
        items: [message()],
        nextCursor: 'cursor-2',
      },
    ],
  };
}

describe('useMessages realtime pagination helpers', () => {
  it('suppresses duplicate message event by id', () => {
    const current = baseData();
    const next = pushMessage(current, message({ id: 'm1', body: 'duplicate' }));

    expect(next?.pages[0].items).toHaveLength(1);
    expect(next?.pages[0].items[0].body).toBe('Hello');
  });

  it('keeps messages sorted by createdAt desc after incoming realtime message', () => {
    const current = baseData();
    const next = pushMessage(
      current,
      message({ id: 'm2', createdAt: '2026-03-17T09:05:00.000Z', body: 'Latest' }),
    );

    expect(next?.pages[0].items.map((item) => item.id)).toEqual(['m2', 'm1']);
  });

  it('applies edited message payload with attachment changes', () => {
    const current = baseData();
    const edited = message({
      id: 'm1',
      body: 'Edited',
      editedAt: '2026-03-17T09:10:00.000Z',
      attachments: [
        {
          attachmentId: 'a1',
          mediaType: 'document',
          mimeType: 'application/pdf',
          fileName: 'doc.pdf',
          fileSizeBytes: 1024,
          storageKey: 'uploads/u1/doc.pdf',
          publicUrl: 'https://cdn.nextwork.local/uploads/u1/doc.pdf',
          width: null,
          height: null,
          durationMs: null,
          thumbnailKey: null,
        },
      ],
    });

    const next = applyEditedMessage(current, edited);

    expect(next?.pages[0].items[0].body).toBe('Edited');
    expect(next?.pages[0].items[0].attachments).toHaveLength(1);
  });
});
