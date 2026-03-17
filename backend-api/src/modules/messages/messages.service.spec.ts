import { ForbiddenException } from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { RedisService } from '../../common/redis/redis.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let service: MessagesService;

  const messagesRepositoryMock = {
    assertParticipant: jest.fn(),
    createMessage: jest.fn(),
    updateMessageBody: jest.fn(),
    findMessageForConversation: jest.fn(),
    countUnreadMessagesForUser: jest.fn(),
    listParticipantIds: jest.fn(),
    listMessagesForConversation: jest.fn(),
    findMessageById: jest.fn(),
    upsertReaction: jest.fn(),
    removeReaction: jest.fn(),
    listMessageReactions: jest.fn(),
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

  const mediaServiceMock = {
    isPublicMediaUrlAllowed: jest.fn(() => true),
  } as unknown as MediaService;

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
      mediaServiceMock,
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
      attachments: [],
      reactions: [],
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
        attachments: [],
        reactions: [],
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

  it('allows sender to edit message and publishes edited event', async () => {
    (messagesRepositoryMock.assertParticipant as jest.Mock).mockResolvedValue(true);
    (messagesRepositoryMock.findMessageForConversation as jest.Mock).mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      body: 'Old body',
      createdAt: new Date('2026-03-16T01:00:00.000Z'),
      editedAt: null,
    });
    (messagesRepositoryMock.updateMessageBody as jest.Mock).mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      body: 'New body',
      messageType: 'text',
      attachments: [],
      reactions: [],
      createdAt: new Date('2026-03-16T01:00:00.000Z'),
      editedAt: new Date('2026-03-16T01:10:00.000Z'),
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

    const result = await service.updateMessage('u1', 'c1', 'm1', { body: 'New body' });

    expect(result.body).toBe('New body');
    expect(redisPublishMock).toHaveBeenCalledWith(
      service.getEditChannelName(),
      expect.stringContaining('"conversationId":"c1"'),
    );
  });

  it('returns aggregate unread count for badge sync', async () => {
    (messagesRepositoryMock.countUnreadMessagesForUser as jest.Mock).mockResolvedValue(9);

    const result = await service.getUnreadCount('u1');

    expect(result).toEqual({ unreadCount: 9 });
  });

  it('accepts message attachments when media URLs are authorized', async () => {
    (messagesRepositoryMock.assertParticipant as jest.Mock).mockResolvedValue(true);
    (messagesRepositoryMock.listParticipantIds as jest.Mock).mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
    (messagesRepositoryMock.createMessage as jest.Mock).mockResolvedValue({
      id: 'm2',
      conversationId: 'c1',
      senderId: 'u1',
      body: '',
      messageType: 'attachment',
      attachments: [
        {
          attachmentId: 'a1',
          mediaType: 'image',
          mimeType: 'image/jpeg',
          fileName: 'pic.jpg',
          fileSizeBytes: 1024,
          storageKey: 'uploads/u1/x.jpg',
          publicUrl: 'https://cdn.workplace.local/uploads/u1/x.jpg',
          width: 800,
          height: 600,
          durationMs: null,
          thumbnailKey: null,
          createdAt: new Date('2026-03-16T01:00:00.000Z'),
        },
      ],
      reactions: [],
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

    const result = await service.sendMessage('u1', 'c1', {
      attachments: [
        {
          mediaType: 'image',
          mimeType: 'image/jpeg',
          fileName: 'pic.jpg',
          fileSizeBytes: 1024,
          storageKey: 'uploads/u1/x.jpg',
          publicUrl: 'https://cdn.workplace.local/uploads/u1/x.jpg',
          width: 800,
          height: 600,
        },
      ],
    });

    expect(result.attachments).toHaveLength(1);
    expect((mediaServiceMock.isPublicMediaUrlAllowed as jest.Mock).mock.calls.length).toBeGreaterThan(0);
  });

  it('rejects attachment URL that is not allowed for sender', async () => {
    (messagesRepositoryMock.assertParticipant as jest.Mock).mockResolvedValue(true);
    (messagesRepositoryMock.listParticipantIds as jest.Mock).mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
    (mediaServiceMock.isPublicMediaUrlAllowed as jest.Mock).mockReturnValue(false);

    await expect(
      service.sendMessage('u1', 'c1', {
        attachments: [
          {
            mediaType: 'document',
            mimeType: 'application/pdf',
            fileName: 'spec.pdf',
            fileSizeBytes: 4096,
            storageKey: 'uploads/u2/spec.pdf',
            publicUrl: 'https://cdn.workplace.local/uploads/u2/spec.pdf',
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('upserts reaction with idempotent summary response', async () => {
    (messagesRepositoryMock.findMessageById as jest.Mock).mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u2',
      createdAt: new Date('2026-03-16T01:00:00.000Z'),
    });
    (messagesRepositoryMock.assertParticipant as jest.Mock).mockResolvedValue(true);
    (messagesRepositoryMock.listParticipantIds as jest.Mock).mockResolvedValue([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
    (messagesRepositoryMock.listMessageReactions as jest.Mock).mockResolvedValue([
      { userId: 'u1', reactionType: 'heart' },
      { userId: 'u2', reactionType: 'heart' },
    ]);

    const result = await service.upsertMessageReaction('u1', 'm1', { reactionType: 'heart' });

    expect(messagesRepositoryMock.upsertReaction).toHaveBeenCalledWith({
      messageId: 'm1',
      userId: 'u1',
      reactionType: 'heart',
    });
    expect(result.reactions).toEqual([
      {
        reactionType: 'heart',
        count: 2,
        reactedByMe: true,
      },
    ]);
  });

  it('rejects reaction update when user is not a participant', async () => {
    (messagesRepositoryMock.findMessageById as jest.Mock).mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u2',
      createdAt: new Date('2026-03-16T01:00:00.000Z'),
    });
    (messagesRepositoryMock.assertParticipant as jest.Mock).mockResolvedValue(false);

    await expect(service.upsertMessageReaction('u3', 'm1', { reactionType: 'heart' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
