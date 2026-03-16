import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class FeedRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getFolloweeIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      select: { followeeId: true },
    });

    return rows.map((row: { followeeId: string }) => row.followeeId);
  }

  async getGroupIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });

    return rows.map((row: { groupId: string }) => row.groupId);
  }
}
