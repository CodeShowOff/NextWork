import { Injectable, NotFoundException } from '@nestjs/common';

import { ListLikesQueryDto } from './dto/list-likes-query.dto';
import { LikesRepository } from './likes.repository';
import { NotificationsService } from '../notifications/notifications.service';

export interface LikersResponse {
  items: Array<{
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    likedAt: string;
  }>;
  nextCursor: string | null;
}

@Injectable()
export class LikesService {
  constructor(
    private readonly likesRepository: LikesRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async likePost(userId: string, postId: string): Promise<{ liked: true; likeCount: number }> {
    const post = await this.getPostOrThrow(postId);
    let created = false;

    try {
      await this.likesRepository.createLike(userId, postId);
      created = true;
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

    if (created) {
      await this.notificationsService.createNotification({
        userId: post.authorId,
        actorId: userId,
        type: 'like',
        entityType: 'post',
        entityId: postId,
      });
    }

    const likeCount = await this.likesRepository.countLikes(postId);
    return { liked: true, likeCount };
  }

  async unlikePost(userId: string, postId: string): Promise<{ liked: false; likeCount: number }> {
    await this.assertPostExists(postId);

    await this.likesRepository.removeLike(userId, postId);
    const likeCount = await this.likesRepository.countLikes(postId);
    return { liked: false, likeCount };
  }

  async getLikeState(userId: string, postId: string): Promise<{
    postId: string;
    likedByMe: boolean;
    likeCount: number;
  }> {
    await this.assertPostExists(postId);

    const [likedByMe, likeCount] = await Promise.all([
      this.likesRepository.isLikedByUser(userId, postId),
      this.likesRepository.countLikes(postId),
    ]);

    return { postId, likedByMe, likeCount };
  }

  async listLikers(postId: string, query: ListLikesQueryDto): Promise<LikersResponse> {
    await this.assertPostExists(postId);

    const pageSize = query.limit ?? 20;
    const rows = await this.likesRepository.listLikers({
      postId,
      before: query.before ? new Date(query.before) : undefined,
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      items: items.map((row) => ({
        userId: row.user.id,
        displayName: row.user.profile?.displayName ?? 'Unknown',
        avatarUrl: row.user.profile?.avatarUrl ?? null,
        likedAt: row.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  private async assertPostExists(postId: string): Promise<void> {
    const post = await this.likesRepository.getPostAuthorId(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
  }

  private async getPostOrThrow(postId: string): Promise<{ authorId: string }> {
    const post = await this.likesRepository.getPostAuthorId(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }
}
