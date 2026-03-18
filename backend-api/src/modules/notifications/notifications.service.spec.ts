import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { RedisService } from '../../common/redis/redis.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const notificationsRepositoryMock = {
    findById: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    countUnread: jest.fn(),
    create: jest.fn(),
    getPreferences: jest.fn(),
    isMuted: jest.fn(),
    userExists: jest.fn(),
    hasRecentThanks: jest.fn(),
    findOrCreateDirectConversationBetweenUsers: jest.fn(),
    createDirectMessage: jest.fn(),
    registerDeviceToken: jest.fn(),
    touchDeviceToken: jest.fn(),
    unregisterDeviceToken: jest.fn(),
  } as unknown as NotificationsRepository;

  const redisPublishMock = jest.fn();
  const redisServiceMock = {
    getClient: jest.fn(() => ({
      publish: redisPublishMock,
    })),
  } as unknown as RedisService;

  const cacheServiceMock = {
    getJson: jest.fn(),
    setJson: jest.fn(),
    deleteByKey: jest.fn(),
  } as unknown as CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationsService(notificationsRepositoryMock, redisServiceMock, cacheServiceMock);
  });

  it('publishes notification.read event when single notification is marked read', async () => {
    (notificationsRepositoryMock.findById as jest.Mock).mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      isRead: false,
    });

    const result = await service.markRead('u1', 'n1');

    expect(result).toEqual({ status: 'ok' });
    expect(notificationsRepositoryMock.markRead).toHaveBeenCalledWith('n1');
    expect(redisPublishMock).toHaveBeenCalledWith(
      service.getNotificationReadChannel(),
      expect.stringContaining('"notificationId":"n1"'),
    );
    expect(cacheServiceMock.deleteByKey).toHaveBeenCalledWith('notifications:unread:u1');
  });

  it('publishes read-all event so other sessions can synchronize state', async () => {
    (notificationsRepositoryMock.markAllRead as jest.Mock).mockResolvedValue(3);

    const result = await service.markAllRead('u1');

    expect(result).toEqual({ status: 'ok', updated: 3 });
    expect(redisPublishMock).toHaveBeenCalledWith(
      service.getNotificationReadChannel(),
      expect.stringContaining('"readAll":true'),
    );
    expect(cacheServiceMock.deleteByKey).toHaveBeenCalledWith('notifications:unread:u1');
  });

  it('denies markRead for another user notification', async () => {
    (notificationsRepositoryMock.findById as jest.Mock).mockResolvedValue({
      id: 'n1',
      userId: 'u2',
      isRead: false,
    });

    await expect(service.markRead('u1', 'n1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws not found when marking unknown notification', async () => {
    (notificationsRepositoryMock.findById as jest.Mock).mockResolvedValue(null);

    await expect(service.markRead('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suppresses thanks delivery when sender is muted by target', async () => {
    (notificationsRepositoryMock.userExists as jest.Mock).mockResolvedValue(true);
    (notificationsRepositoryMock.hasRecentThanks as jest.Mock).mockResolvedValue(false);
    (notificationsRepositoryMock.isMuted as jest.Mock).mockResolvedValue(true);

    const result = await service.sendThanks('sender-1', {
      targetUserId: 'target-1',
      notificationType: 'thanks',
    });

    expect(result).toEqual({
      status: 'ok',
      delivered: false,
      muted: true,
      notificationId: null,
      conversationId: null,
      messageId: null,
    });
    expect(notificationsRepositoryMock.create).not.toHaveBeenCalled();
  });

  it('blocks duplicate thanks inside cooldown window', async () => {
    (notificationsRepositoryMock.userExists as jest.Mock).mockResolvedValue(true);
    (notificationsRepositoryMock.hasRecentThanks as jest.Mock).mockResolvedValue(true);

    await expect(
      service.sendThanks('sender-1', {
        targetUserId: 'target-1',
        notificationType: 'thanks',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('openNotification marks unread notification and returns canonical message route', async () => {
    (notificationsRepositoryMock.findById as jest.Mock).mockResolvedValue({
      id: 'n-open-1',
      userId: 'u1',
      isRead: false,
      entityType: 'conversation',
      entityId: 'c1',
    });

    const result = await service.openNotification('u1', 'n-open-1');

    expect(result.readApplied).toBe(true);
    expect(result.action).toEqual({
      target: 'messages',
      entityType: 'conversation',
      entityId: 'c1',
    });
    expect(notificationsRepositoryMock.markRead).toHaveBeenCalledWith('n-open-1');
  });

  it('openNotification denies opening notifications from another user', async () => {
    (notificationsRepositoryMock.findById as jest.Mock).mockResolvedValue({
      id: 'n-open-2',
      userId: 'u2',
      isRead: false,
      entityType: 'user',
      entityId: 'u9',
    });

    await expect(service.openNotification('u1', 'n-open-2')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('registers a device token and returns normalized response', async () => {
    (notificationsRepositoryMock.registerDeviceToken as jest.Mock).mockResolvedValue({
      id: 'dt-1',
      userId: 'u1',
      platform: 'ios',
      token: 'token_1234567890123456',
      lastSeenAt: new Date('2026-03-18T09:00:00.000Z'),
    });

    const result = await service.registerDeviceToken('u1', {
      platform: 'ios',
      token: 'token_1234567890123456',
    });

    expect(notificationsRepositoryMock.registerDeviceToken).toHaveBeenCalledWith({
      userId: 'u1',
      platform: 'ios',
      token: 'token_1234567890123456',
    });
    expect(result).toEqual({
      status: 'ok',
      deviceToken: {
        id: 'dt-1',
        platform: 'ios',
        token: 'token_1234567890123456',
        lastSeenAt: '2026-03-18T09:00:00.000Z',
      },
    });
  });

  it('updates heartbeat and returns found=true when token exists', async () => {
    (notificationsRepositoryMock.touchDeviceToken as jest.Mock).mockResolvedValue(true);

    const result = await service.heartbeatDeviceToken('u1', {
      token: 'token_1234567890123456',
      platform: 'android',
    });

    expect(notificationsRepositoryMock.touchDeviceToken).toHaveBeenCalledWith({
      userId: 'u1',
      token: 'token_1234567890123456',
      platform: 'android',
    });
    expect(result).toEqual({ status: 'ok', found: true });
  });

  it('unregisters device token and reports removal status', async () => {
    (notificationsRepositoryMock.unregisterDeviceToken as jest.Mock).mockResolvedValue(true);

    const result = await service.unregisterDeviceToken('u1', {
      token: 'token_1234567890123456',
    });

    expect(notificationsRepositoryMock.unregisterDeviceToken).toHaveBeenCalledWith({
      userId: 'u1',
      token: 'token_1234567890123456',
    });
    expect(result).toEqual({ status: 'ok', removed: true });
  });
});
