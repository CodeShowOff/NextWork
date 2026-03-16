import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class LikesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async postExists(postId: string): Promise<boolean> {
    const row = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });

    return !!row;
  }

  getPostAuthorId(postId: string): Promise<{ authorId: string } | null> {
    return this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        authorId: true,
      },
    });
  }

  async createLike(userId: string, postId: string): Promise<void> {
    await this.prisma.like.create({
      data: {
        userId,
        postId,
      },
    });
  }

  async removeLike(userId: string, postId: string): Promise<void> {
    await this.prisma.like.deleteMany({
      where: {
        userId,
        postId,
      },
    });
  }

  isLikedByUser(userId: string, postId: string): Promise<boolean> {
    return this.prisma.like
      .findUnique({
        where: {
          userId_postId: {
            userId,
            postId,
          },
        },
      })
      .then((row) => !!row);
  }

  countLikes(postId: string): Promise<number> {
    return this.prisma.like.count({
      where: { postId },
    });
  }

  listLikers(params: {
    postId: string;
    before?: Date;
    take: number;
  }): Promise<
    Array<{
      id: string;
      createdAt: Date;
      user: {
        id: string;
        profile: {
          displayName: string;
          avatarUrl: string | null;
        } | null;
      };
    }>
  > {
    return this.prisma.like.findMany({
      where: {
        postId: params.postId,
        ...(params.before ? { createdAt: { lt: params.before } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
  }
}
