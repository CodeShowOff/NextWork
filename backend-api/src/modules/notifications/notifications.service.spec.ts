import { ForbiddenException, NotFoundException } from '@nestjs/common';

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
});
