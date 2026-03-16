import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { RedisService } from '../../common/redis/redis.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { NotificationsRepository } from './notifications.repository';

export interface NotificationView {
  id: string;
  userId: string;
  actorId: string | null;
  type: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

export interface PaginatedNotificationsResponse {
  items: NotificationView[];
  nextCursor: string | null;
}

export interface NotificationPreferencesView {
  likeEnabled: boolean;
  commentEnabled: boolean;
  followEnabled: boolean;
  messageEnabled: boolean;
}

export interface NotificationMutedUserView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface NotificationEvent {
  userId: string;
  notification: NotificationView;
}

interface NotificationReadEvent {
  userId: string;
  notificationId?: string;
  readAll?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly notificationCreatedChannel = 'notifications:new';
  private readonly notificationReadChannel = 'notifications:read';

  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
  ) {}

  async createNotification(params: {
    userId: string;
    actorId?: string;
    type: string;
    entityType: string;
    entityId: string;
  }): Promise<NotificationView | null> {
    if (params.actorId && params.actorId === params.userId) {
      return null;
    }

    const preferences = await this.notificationsRepository.getPreferences(params.userId);
    if (!this.isTypeEnabled(params.type, preferences)) {
      return null;
    }

    if (params.actorId) {
      const muted = await this.notificationsRepository.isMuted(params.userId, params.actorId);
      if (muted) {
        return null;
      }
    }

    const row = await this.notificationsRepository.create(params);
    const notification = this.toView(row);

    const event: NotificationEvent = {
      userId: notification.userId,
      notification,
    };

    await this.cacheService.deleteByKey(`notifications:unread:${notification.userId}`);

    await this.redisService
      .getClient()
      .publish(this.notificationCreatedChannel, JSON.stringify(event));

    return notification;
  }

  async listForUser(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponse> {
    const pageSize = query.limit ?? 20;
    const rows = await this.notificationsRepository.listByUser({
      userId,
      before: query.before ? new Date(query.before) : undefined,
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      items: items.map((item: Awaited<ReturnType<NotificationsRepository['listByUser']>>[number]) =>
        this.toView(item),
      ),
      nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const cacheKey = `notifications:unread:${userId}`;
    return this.cacheService.getJson<{ unreadCount: number }>(cacheKey).then(async (cached) => {
      if (cached) {
        return cached;
      }

      const count = await this.notificationsRepository.countUnread(userId);
      const payload = { unreadCount: count };
      await this.cacheService.setJson(cacheKey, payload, 15);
      return payload;
    });
  }

  async markRead(userId: string, notificationId: string): Promise<{ status: 'ok' }> {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Not allowed to update this notification');
    }

    if (!notification.isRead) {
      await this.notificationsRepository.markRead(notificationId);
      const event: NotificationReadEvent = {
        userId,
        notificationId,
      };

      await this.redisService
        .getClient()
        .publish(this.notificationReadChannel, JSON.stringify(event));
      await this.cacheService.deleteByKey(`notifications:unread:${userId}`);
    }

    return { status: 'ok' };
  }

  async markAllRead(userId: string): Promise<{ status: 'ok'; updated: number }> {
    const updated = await this.notificationsRepository.markAllRead(userId);

    if (updated > 0) {
      const event: NotificationReadEvent = {
        userId,
        readAll: true,
      };

      await this.redisService
        .getClient()
        .publish(this.notificationReadChannel, JSON.stringify(event));
      await this.cacheService.deleteByKey(`notifications:unread:${userId}`);
    }

    return {
      status: 'ok',
      updated,
    };
  }

  getNotificationCreatedChannel(): string {
    return this.notificationCreatedChannel;
  }

  getNotificationReadChannel(): string {
    return this.notificationReadChannel;
  }

  async getPreferences(userId: string): Promise<NotificationPreferencesView> {
    const preferences = await this.notificationsRepository.getPreferences(userId);
    return {
      likeEnabled: preferences?.likeEnabled ?? true,
      commentEnabled: preferences?.commentEnabled ?? true,
      followEnabled: preferences?.followEnabled ?? true,
      messageEnabled: preferences?.messageEnabled ?? true,
    };
  }

  async updatePreferences(
    userId: string,
    payload: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesView> {
    const hasAnyUpdate =
      typeof payload.likeEnabled === 'boolean' ||
      typeof payload.commentEnabled === 'boolean' ||
      typeof payload.followEnabled === 'boolean' ||
      typeof payload.messageEnabled === 'boolean';

    if (!hasAnyUpdate) {
      return this.getPreferences(userId);
    }

    const updated = await this.notificationsRepository.upsertPreferences(userId, payload);
    return {
      likeEnabled: updated.likeEnabled,
      commentEnabled: updated.commentEnabled,
      followEnabled: updated.followEnabled,
      messageEnabled: updated.messageEnabled,
    };
  }

  async listMutedActors(userId: string): Promise<{ items: NotificationMutedUserView[] }> {
    const rows = await this.notificationsRepository.listMutedActors(userId);
    return {
      items: rows.map((row) => ({
        userId: row.mutedUser.id,
        displayName: row.mutedUser.profile?.displayName ?? 'Unknown',
        avatarUrl: row.mutedUser.profile?.avatarUrl ?? null,
      })),
    };
  }

  async muteActor(userId: string, mutedUserId: string): Promise<{ status: 'ok' }> {
    if (userId === mutedUserId) {
      return { status: 'ok' };
    }

    await this.notificationsRepository.muteActor(userId, mutedUserId);
    return { status: 'ok' };
  }

  async unmuteActor(userId: string, mutedUserId: string): Promise<{ status: 'ok' }> {
    await this.notificationsRepository.unmuteActor(userId, mutedUserId);
    return { status: 'ok' };
  }

  private isTypeEnabled(
    type: string,
    preferences: {
      likeEnabled: boolean;
      commentEnabled: boolean;
      followEnabled: boolean;
      messageEnabled: boolean;
    } | null,
  ): boolean {
    switch (type) {
      case 'like':
        return preferences?.likeEnabled ?? true;
      case 'comment':
        return preferences?.commentEnabled ?? true;
      case 'follow':
        return preferences?.followEnabled ?? true;
      case 'message':
        return preferences?.messageEnabled ?? true;
      default:
        return true;
    }
  }

  private toView(row: {
    id: string;
    userId: string;
    actorId: string | null;
    type: string;
    entityType: string;
    entityId: string;
    isRead: boolean;
    createdAt: Date;
    actor: {
      id: string;
      profile: {
        displayName: string;
        avatarUrl: string | null;
      } | null;
    } | null;
  }): NotificationView {
    return {
      id: row.id,
      userId: row.userId,
      actorId: row.actorId,
      type: row.type,
      entityType: row.entityType,
      entityId: row.entityId,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor
        ? {
            id: row.actor.id,
            displayName: row.actor.profile?.displayName ?? 'Unknown',
            avatarUrl: row.actor.profile?.avatarUrl ?? null,
          }
        : null,
    };
  }
}
