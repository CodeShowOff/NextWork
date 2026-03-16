import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { BackgroundJobsService } from '../../common/reliability/background-jobs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { ListFollowsQueryDto } from './dto/list-follows-query.dto';
import { FollowsRepository } from './follows.repository';

export interface FollowUserView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  followedAt: string;
}

export interface PaginatedFollowUsers {
  items: FollowUserView[];
  nextCursor: string | null;
}

@Injectable()
export class FollowsService {
  constructor(
    private readonly followsRepository: FollowsRepository,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly backgroundJobsService: BackgroundJobsService,
  ) {}

  async followUser(currentUserId: string, targetUserId: string): Promise<{ isFollowing: true }> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const targetUser = await this.usersService.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    try {
      await this.followsRepository.create(currentUserId, targetUserId);

      await this.notificationsService.createNotification({
        userId: targetUserId,
        actorId: currentUserId,
        type: 'follow',
        entityType: 'user',
        entityId: currentUserId,
      });
    } catch (error: unknown) {
      const isUniqueViolation =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002';

      if (!isUniqueViolation) {
        throw error;
      }
    }

    await this.backgroundJobsService.enqueueCachePrefixInvalidation(`feed:${currentUserId}:`);

    return { isFollowing: true };
  }

  async unfollowUser(currentUserId: string, targetUserId: string): Promise<{ isFollowing: false }> {
    if (currentUserId === targetUserId) {
      throw new BadRequestException('Cannot unfollow yourself');
    }

    await this.followsRepository.remove(currentUserId, targetUserId);
    await this.backgroundJobsService.enqueueCachePrefixInvalidation(`feed:${currentUserId}:`);
    return { isFollowing: false };
  }

  async getRelationship(currentUserId: string, targetUserId: string): Promise<{
    isFollowing: boolean;
    followersCount: number;
    followingCount: number;
  }> {
    const targetUser = await this.usersService.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const [isFollowing, counts] = await Promise.all([
      this.followsRepository.isFollowing(currentUserId, targetUserId),
      this.followsRepository.getFollowCounts(targetUserId),
    ]);

    return {
      isFollowing,
      followersCount: counts[0],
      followingCount: counts[1],
    };
  }

  async listFollowers(userId: string, query: ListFollowsQueryDto): Promise<PaginatedFollowUsers> {
    const targetUser = await this.usersService.findById(userId);
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const pageSize = query.limit ?? 20;
    const rows = await this.followsRepository.listFollowers({
      userId,
      before: query.before ? new Date(query.before) : undefined,
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      items: items.map((row) => ({
        userId: row.follower.id,
        displayName: row.follower.profile?.displayName ?? 'Unknown',
        avatarUrl: row.follower.profile?.avatarUrl ?? null,
        followedAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  async listFollowing(userId: string, query: ListFollowsQueryDto): Promise<PaginatedFollowUsers> {
    const targetUser = await this.usersService.findById(userId);
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    const pageSize = query.limit ?? 20;
    const rows = await this.followsRepository.listFollowing({
      userId,
      before: query.before ? new Date(query.before) : undefined,
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      items: items.map((row) => ({
        userId: row.followee.id,
        displayName: row.followee.profile?.displayName ?? 'Unknown',
        avatarUrl: row.followee.profile?.avatarUrl ?? null,
        followedAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }
}
