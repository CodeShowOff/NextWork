import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { RedisService } from '../../common/redis/redis.service';
import { DeviceTokenHeartbeatDto } from './dto/device-token-heartbeat.dto';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { SendThanksDto } from './dto/send-thanks.dto';
import { UnregisterDeviceTokenDto } from './dto/unregister-device-token.dto';
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

export interface DeviceTokenRegistrationView {
  id: string;
  platform: string;
  token: string;
  lastSeenAt: string;
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

interface SendThanksResult {
  status: 'ok';
  delivered: boolean;
  muted: boolean;
  notificationId: string | null;
  conversationId: string | null;
  messageId: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly thanksCooldownMinutes = 60;
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

  async openNotification(
    userId: string,
    notificationId: string,
  ): Promise<{
    status: 'ok';
    readApplied: boolean;
    action: {
      target: 'messages' | 'profile' | 'feed';
      entityType: string;
      entityId: string;
    };
  }> {
    const notification = await this.notificationsRepository.findById(notificationId);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Not allowed to open this notification');
    }

    let readApplied = false;
    if (!notification.isRead) {
      await this.notificationsRepository.markRead(notificationId);
      readApplied = true;

      const event: NotificationReadEvent = {
        userId,
        notificationId,
      };
      await this.redisService
        .getClient()
        .publish(this.notificationReadChannel, JSON.stringify(event));
      await this.cacheService.deleteByKey(`notifications:unread:${userId}`);
    }

    return {
      status: 'ok',
      readApplied,
      action: {
        target: this.resolveOpenTarget(notification.entityType),
        entityType: notification.entityType,
        entityId: notification.entityId,
      },
    };
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

  async registerDeviceToken(
    userId: string,
    payload: RegisterDeviceTokenDto,
  ): Promise<{ status: 'ok'; deviceToken: DeviceTokenRegistrationView }> {
    const row = await this.notificationsRepository.registerDeviceToken({
      userId,
      platform: payload.platform,
      token: payload.token,
    });

    return {
      status: 'ok',
      deviceToken: {
        id: row.id,
        platform: row.platform,
        token: row.token,
        lastSeenAt: row.lastSeenAt.toISOString(),
      },
    };
  }

  async heartbeatDeviceToken(
    userId: string,
    payload: DeviceTokenHeartbeatDto,
  ): Promise<{ status: 'ok'; found: boolean }> {
    const found = await this.notificationsRepository.touchDeviceToken({
      userId,
      token: payload.token,
      ...(payload.platform ? { platform: payload.platform } : {}),
    });

    return {
      status: 'ok',
      found,
    };
  }

  async unregisterDeviceToken(
    userId: string,
    payload: UnregisterDeviceTokenDto,
  ): Promise<{ status: 'ok'; removed: boolean }> {
    const removed = await this.notificationsRepository.unregisterDeviceToken({
      userId,
      token: payload.token,
      ...(payload.platform ? { platform: payload.platform } : {}),
    });

    return {
      status: 'ok',
      removed,
    };
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

  async sendThanks(senderId: string, payload: SendThanksDto): Promise<SendThanksResult> {
    if (senderId === payload.targetUserId) {
      throw new BadRequestException('Cannot send thanks to yourself');
    }

    const targetExists = await this.notificationsRepository.userExists(payload.targetUserId);
    if (!targetExists) {
      throw new NotFoundException('Target user not found');
    }

    const spamSince = new Date(Date.now() - this.thanksCooldownMinutes * 60_000);
    const hasRecentThanks = await this.notificationsRepository.hasRecentThanks({
      actorId: senderId,
      userId: payload.targetUserId,
      since: spamSince,
    });

    if (hasRecentThanks) {
      throw new ConflictException('Thanks already sent recently. Try again later.');
    }

    const muted = await this.notificationsRepository.isMuted(payload.targetUserId, senderId);
    const messageTemplate = payload.messageTemplate?.trim();
    const notificationType = payload.notificationType ?? (messageTemplate ? 'thanks-note' : 'thanks');

    let conversationId: string | null = null;
    let messageId: string | null = null;

    if (!muted && messageTemplate) {
      conversationId = await this.notificationsRepository.findOrCreateDirectConversationBetweenUsers(
        senderId,
        payload.targetUserId,
      );

      const message = await this.notificationsRepository.createDirectMessage({
        conversationId,
        senderId,
        body: messageTemplate,
        messageType: 'thanks',
      });

      messageId = message.id;
    }

    if (muted) {
      return {
        status: 'ok',
        delivered: false,
        muted: true,
        notificationId: null,
        conversationId,
        messageId,
      };
    }

    const created = await this.createNotification({
      userId: payload.targetUserId,
      actorId: senderId,
      type: notificationType,
      entityType: 'user',
      entityId: senderId,
    });

    return {
      status: 'ok',
      delivered: Boolean(created),
      muted: false,
      notificationId: created?.id ?? null,
      conversationId,
      messageId,
    };
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

  private resolveOpenTarget(entityType: string): 'messages' | 'profile' | 'feed' {
    if (entityType === 'conversation') {
      return 'messages';
    }

    if (entityType === 'user') {
      return 'profile';
    }

    return 'feed';
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
