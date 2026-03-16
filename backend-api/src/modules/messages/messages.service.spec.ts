import { ForbiddenException } from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { RedisService } from '../../common/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let service: MessagesService;

  const messagesRepositoryMock = {
    assertParticipant: jest.fn(),
    createMessage: jest.fn(),
    listParticipantIds: jest.fn(),
    listMessagesForConversation: jest.fn(),
  } as unknown as MessagesRepository;

  const redisPublishMock = jest.fn();
  const redisServiceMock = {
    getClient: jest.fn(() => ({
      publish: redisPublishMock,
    })),
  } as unknown as RedisService;

  const notificationsServiceMock = {
    createNotification: jest.fn(),
  } as unknown as NotificationsService;

  const cacheServiceMock = {
    deleteByPrefix: jest.fn(),
  } as unknown as CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MessagesService(
      messagesRepositoryMock,
      redisServiceMock,
      notificationsServiceMock,
      cacheServiceMock,
    );
  });

  it('sends message, publishes realtime event, and notifies other participants', async () => {
    (messagesRepositoryMock.assertParticipant as jest.Mock).mockResolvedValue(true);
    (messagesRepositoryMock.createMessage as jest.Mock).mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      body: 'Hello',
      messageType: 'text',
      createdAt: new Date('2026-03-16T01:00:00.000Z'),
      editedAt: null,
      sender: {
        id: 'u1',
        profile: {
          displayName: 'User One',
          avatarUrl: null,
        },
      },
    });
    (messagesRepositoryMock.listParticipantIds as jest.Mock).mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);

    const result = await service.sendMessage('u1', 'c1', { body: 'Hello' });

    expect(result.id).toBe('m1');
    expect(notificationsServiceMock.createNotification).toHaveBeenCalledWith({
      userId: 'u2',
      actorId: 'u1',
      type: 'message',
      entityType: 'conversation',
      entityId: 'c1',
    });
    expect(redisPublishMock).toHaveBeenCalledWith(
      service.getMessageChannelName(),
      expect.stringContaining('"conversationId":"c1"'),
    );
    expect(cacheServiceMock.deleteByPrefix).toHaveBeenCalledWith('conversation-summary:u1:');
    expect(cacheServiceMock.deleteByPrefix).toHaveBeenCalledWith('conversation-summary:u2:');
  });

  it('returns persisted messages for reconnect catch-up via listMessages', async () => {
    (messagesRepositoryMock.assertParticipant as jest.Mock).mockResolvedValue(true);
    (messagesRepositoryMock.listMessagesForConversation as jest.Mock).mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'c1',
        senderId: 'u2',
        body: 'Persisted while offline',
        messageType: 'text',
        createdAt: new Date('2026-03-16T01:00:00.000Z'),
        editedAt: null,
        sender: {
          id: 'u2',
          profile: {
            displayName: 'User Two',
            avatarUrl: null,
          },
        },
      },
    ]);

    const page = await service.listMessages('u1', 'c1', { limit: 20 });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.body).toBe('Persisted while offline');
    expect(page.nextCursor).toBeNull();
  });

  it('rejects listMessages when user is not a participant', async () => {
    (messagesRepositoryMock.assertParticipant as jest.Mock).mockResolvedValue(false);

    await expect(service.listMessages('u3', 'c1', { limit: 20 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
