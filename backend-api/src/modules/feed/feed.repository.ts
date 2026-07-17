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
    const rows = await this.prisma.group.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          {
            organization: {
              members: {
                some: { userId, role: { in: ['owner', 'admin'] } },
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    return rows.map((row: { id: string }) => row.id);
  }
}
