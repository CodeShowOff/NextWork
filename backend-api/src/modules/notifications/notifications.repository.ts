import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

export type NotificationPreferenceRow = {
  userId: string;
  likeEnabled: boolean;
  commentEnabled: boolean;
  followEnabled: boolean;
  messageEnabled: boolean;
};

export type NotificationMuteRow = {
  mutedUserId: string;
  mutedUser: {
    id: string;
    profile: {
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
};

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(params: {
    userId: string;
    actorId?: string;
    type: string;
    entityType: string;
    entityId: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        ...(params.actorId ? { actorId: params.actorId } : {}),
        type: params.type,
        entityType: params.entityType,
        entityId: params.entityId,
      },
      include: {
        actor: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  listByUser(params: { userId: string; before?: Date; take: number }) {
    return this.prisma.notification.findMany({
      where: {
        userId: params.userId,
        ...(params.before ? { createdAt: { lt: params.before } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      include: {
        actor: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  findById(notificationId: string): Promise<{
    id: string;
    userId: string;
    isRead: boolean;
  } | null> {
    return this.prisma.notification.findUnique({
      where: {
        id: notificationId,
      },
      select: {
        id: true,
        userId: true,
        isRead: true,
      },
    });
  }

  async markRead(notificationId: string): Promise<void> {
    await this.prisma.notification.update({
      where: {
        id: notificationId,
      },
      data: {
        isRead: true,
      },
    });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return result.count;
  }

  getPreferences(userId: string): Promise<NotificationPreferenceRow | null> {
    return this.prisma.notificationPreference.findUnique({
      where: {
        userId,
      },
    });
  }

  upsertPreferences(
    userId: string,
    payload: Partial<{
      likeEnabled: boolean;
      commentEnabled: boolean;
      followEnabled: boolean;
      messageEnabled: boolean;
    }>,
  ): Promise<NotificationPreferenceRow> {
    return this.prisma.notificationPreference.upsert({
      where: {
        userId,
      },
      create: {
        userId,
        likeEnabled: payload.likeEnabled ?? true,
        commentEnabled: payload.commentEnabled ?? true,
        followEnabled: payload.followEnabled ?? true,
        messageEnabled: payload.messageEnabled ?? true,
      },
      update: {
        ...(typeof payload.likeEnabled === 'boolean' ? { likeEnabled: payload.likeEnabled } : {}),
        ...(typeof payload.commentEnabled === 'boolean'
          ? { commentEnabled: payload.commentEnabled }
          : {}),
        ...(typeof payload.followEnabled === 'boolean' ? { followEnabled: payload.followEnabled } : {}),
        ...(typeof payload.messageEnabled === 'boolean' ? { messageEnabled: payload.messageEnabled } : {}),
      },
    });
  }

  async isMuted(userId: string, mutedUserId: string): Promise<boolean> {
    const result = await this.prisma.notificationMute.findUnique({
      where: {
        userId_mutedUserId: {
          userId,
          mutedUserId,
        },
      },
      select: {
        userId: true,
      },
    });

    return Boolean(result);
  }

  async muteActor(userId: string, mutedUserId: string): Promise<void> {
    await this.prisma.notificationMute.upsert({
      where: {
        userId_mutedUserId: {
          userId,
          mutedUserId,
        },
      },
      create: {
        userId,
        mutedUserId,
      },
      update: {},
    });
  }

  async unmuteActor(userId: string, mutedUserId: string): Promise<void> {
    try {
      await this.prisma.notificationMute.delete({
        where: {
          userId_mutedUserId: {
            userId,
            mutedUserId,
          },
        },
      });
    } catch (error: unknown) {
      const isRecordNotFound =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2025';

      if (isRecordNotFound) {
        return;
      }

      throw error;
    }
  }

  listMutedActors(userId: string): Promise<NotificationMuteRow[]> {
    return this.prisma.notificationMute.findMany({
      where: {
        userId,
      },
      orderBy: [{ createdAt: 'desc' }, { mutedUserId: 'asc' }],
      include: {
        mutedUser: {
          include: {
            profile: true,
          },
        },
      },
    }) as unknown as Promise<NotificationMuteRow[]>;
  }
}
