import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class FollowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(followerId: string, followeeId: string): Promise<void> {
    await this.prisma.follow.create({
      data: {
        followerId,
        followeeId,
      },
    });
  }

  async remove(followerId: string, followeeId: string): Promise<void> {
    await this.prisma.follow.deleteMany({
      where: {
        followerId,
        followeeId,
      },
    });
  }

  isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    return this.prisma.follow
      .findUnique({
        where: {
          followerId_followeeId: {
            followerId,
            followeeId,
          },
        },
      })
      .then((row) => !!row);
  }

  getFollowCounts(userId: string): Promise<[number, number]> {
    return Promise.all([
      this.prisma.follow.count({ where: { followeeId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
  }

  listFollowers(params: {
    userId: string;
    before?: Date;
    take: number;
  }): Promise<
    Array<{
      followerId: string;
      createdAt: Date;
      follower: {
        id: string;
        profile: {
          displayName: string;
          avatarUrl: string | null;
        } | null;
      };
    }>
  > {
    return this.prisma.follow.findMany({
      where: {
        followeeId: params.userId,
        ...(params.before ? { createdAt: { lt: params.before } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: params.take,
      include: {
        follower: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  listFollowing(params: {
    userId: string;
    before?: Date;
    take: number;
  }): Promise<
    Array<{
      followeeId: string;
      createdAt: Date;
      followee: {
        id: string;
        profile: {
          displayName: string;
          avatarUrl: string | null;
        } | null;
      };
    }>
  > {
    return this.prisma.follow.findMany({
      where: {
        followerId: params.userId,
        ...(params.before ? { createdAt: { lt: params.before } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { followeeId: 'desc' }],
      take: params.take,
      include: {
        followee: {
          include: {
            profile: true,
          },
        },
      },
    });
  }
}
