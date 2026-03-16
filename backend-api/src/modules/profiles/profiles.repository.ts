import { Injectable } from '@nestjs/common';
import { Prisma, Profile } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class ProfilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  updateByUserId(userId: string, data: Prisma.ProfileUpdateInput): Promise<Profile> {
    return this.prisma.profile.update({ where: { userId }, data });
  }

  getFollowCounts(userId: string): Promise<[number, number]> {
    return Promise.all([
      this.prisma.follow.count({ where: { followeeId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
  }

  isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    if (followerId === followeeId) {
      return Promise.resolve(false);
    }

    return this.prisma.follow
      .findUnique({
        where: {
          followerId_followeeId: {
            followerId,
            followeeId,
          },
        },
      })
      .then((row) => Boolean(row));
  }

  countPostsByUserId(userId: string): Promise<number> {
    return this.prisma.post.count({ where: { authorId: userId } });
  }
}
