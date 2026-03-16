import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

const postInclude = {
  author: {
    include: {
      profile: true,
    },
  },
  media: {
    orderBy: {
      sortOrder: 'asc' as const,
    },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
    },
  },
};

export interface PostWithRelations {
  id: string;
  authorId: string;
  groupId: string | null;
  content: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    profile: {
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
  media: Array<{
    id: string;
    mediaUrl: string;
    mediaType: string;
    width: number | null;
    height: number | null;
    sortOrder: number;
  }>;
  _count: {
    likes: number;
    comments: number;
  };
}

@Injectable()
export class PostsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.PostCreateInput): Promise<PostWithRelations> {
    return this.prisma.post.create({
      data,
      include: postInclude,
    }) as unknown as Promise<PostWithRelations>;
  }

  findByUserId(params: {
    userId: string;
    viewerId: string;
    before?: Date;
    groupId?: string;
    take: number;
  }): Promise<PostWithRelations[]> {
    const where: Prisma.PostWhereInput = {
      authorId: params.userId,
      ...(params.before ? { createdAt: { lt: params.before } } : {}),
      ...(params.groupId ? { groupId: params.groupId } : {}),
      ...(params.viewerId === params.userId ? {} : { visibility: 'public' }),
    };

    return this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      include: postInclude,
    }) as unknown as Promise<PostWithRelations[]>;
  }

  findFeedPosts(params: {
    viewerId: string;
    authorIds: string[];
    groupIds: string[];
    before?: Date;
    groupId?: string;
    take: number;
  }): Promise<PostWithRelations[]> {
    const where: Prisma.PostWhereInput = params.groupId
      ? {
          groupId: params.groupId,
          ...(params.before ? { createdAt: { lt: params.before } } : {}),
          OR: [
            { authorId: { in: params.authorIds } },
            {
              group: {
                members: {
                  some: {
                    userId: params.viewerId,
                  },
                },
              },
            },
          ],
        }
      : {
          ...(params.before ? { createdAt: { lt: params.before } } : {}),
          OR: [
            {
              authorId: { in: params.authorIds },
              OR: [{ visibility: 'public' }, { authorId: params.viewerId }],
            },
            ...(params.groupIds.length
              ? [
                  {
                    groupId: { in: params.groupIds },
                  },
                ]
              : []),
          ],
        };

    return this.prisma.post.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      include: postInclude,
    }) as unknown as Promise<PostWithRelations[]>;
  }

  async listFollowerIds(authorId: string): Promise<string[]> {
    const rows = await this.prisma.follow.findMany({
      where: {
        followeeId: authorId,
      },
      select: {
        followerId: true,
      },
    });

    return rows.map((row: { followerId: string }) => row.followerId);
  }

  findGroupById(groupId: string): Promise<{ id: string } | null> {
    return this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
  }

  async isGroupMember(userId: string, groupId: string): Promise<boolean> {
    const row = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: { userId: true },
    });

    return Boolean(row);
  }

  async listGroupMemberIds(groupId: string): Promise<string[]> {
    const rows = await this.prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });

    return rows.map((row: { userId: string }) => row.userId);
  }
}
