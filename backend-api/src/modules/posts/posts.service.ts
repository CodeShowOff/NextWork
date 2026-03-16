import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BackgroundJobsService } from '../../common/reliability/background-jobs.service';
import { MediaService } from '../media/media.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostWithRelations, PostsRepository } from './posts.repository';

export interface PostMediaView {
  id: string;
  url: string;
  type: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

export interface PostView {
  id: string;
  authorId: string;
  groupId: string | null;
  content: string;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  media: PostMediaView[];
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  stats: {
    likeCount: number;
    commentCount: number;
  };
}

export interface PaginatedPostsResponse {
  items: PostView[];
  nextCursor: string | null;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly mediaService: MediaService,
  ) {}

  async createPost(userId: string, payload: CreatePostDto): Promise<PostView> {
    this.assertMediaUrlsBelongToAuthor(userId, payload.media);

    if (payload.groupId) {
      const group = await this.postsRepository.findGroupById(payload.groupId);
      if (!group) {
        throw new NotFoundException('Group not found');
      }

      const isMember = await this.postsRepository.isGroupMember(userId, payload.groupId);
      if (!isMember) {
        throw new ForbiddenException('Not a member of this group');
      }
    }

    const data: Prisma.PostCreateInput = {
      author: {
        connect: { id: userId },
      },
      ...(payload.groupId
        ? {
            group: {
              connect: { id: payload.groupId },
            },
          }
        : {}),
      content: payload.content,
      visibility: payload.visibility ?? 'public',
      ...(payload.media?.length
        ? {
            media: {
              create: payload.media.map((item, index) => ({
                mediaUrl: item.url,
                mediaType: item.type,
                width: item.width,
                height: item.height,
                sortOrder: index,
              })),
            },
          }
        : {}),
    };

    const post = await this.postsRepository.create(data);

    const impactedUsers = new Set<string>([userId, ...(await this.postsRepository.listFollowerIds(userId))]);
    if (payload.groupId) {
      const groupMemberIds = await this.postsRepository.listGroupMemberIds(payload.groupId);
      for (const memberId of groupMemberIds) {
        impactedUsers.add(memberId);
      }
    }

    await Promise.all(
      [...impactedUsers].map((impactedUserId) =>
        this.backgroundJobsService.enqueueCachePrefixInvalidation(`feed:${impactedUserId}:`),
      ),
    );

    return this.toPostView(post);
  }

  async listPostsByUser(
    userId: string,
    viewerId: string,
    query: ListPostsQueryDto,
  ): Promise<PaginatedPostsResponse> {
    const take = (query.limit ?? 20) + 1;
    const before = query.before ? new Date(query.before) : undefined;

    const posts = await this.postsRepository.findByUserId({
      userId,
      viewerId,
      before,
      groupId: query.groupId,
      take,
    });

    return this.toPaginatedResult(posts, query.limit ?? 20);
  }

  async listFeedPosts(
    viewerId: string,
    authorIds: string[],
    groupIds: string[],
    query: ListPostsQueryDto,
  ): Promise<PaginatedPostsResponse> {
    if (!authorIds.length && !groupIds.length) {
      return { items: [], nextCursor: null };
    }

    if (query.groupId && !groupIds.includes(query.groupId)) {
      throw new ForbiddenException('Not a member of this group');
    }

    const take = (query.limit ?? 20) + 1;
    const before = query.before ? new Date(query.before) : undefined;

    const posts = await this.postsRepository.findFeedPosts({
      viewerId,
      authorIds,
      groupIds,
      before,
      groupId: query.groupId,
      take,
    });

    return this.toPaginatedResult(posts, query.limit ?? 20);
  }

  private assertMediaUrlsBelongToAuthor(userId: string, media?: { url: string }[]): void {
    if (!media?.length) {
      return;
    }

    const hasInvalidUrl = media.some(
      (item) => !this.mediaService.isPublicMediaUrlAllowed(userId, item.url),
    );
    if (hasInvalidUrl) {
      throw new ForbiddenException('Media URL is not permitted for this author');
    }
  }

  private toPaginatedResult(posts: PostWithRelations[], pageSize: number): PaginatedPostsResponse {
    const hasMore = posts.length > pageSize;
    const pageItems = hasMore ? posts.slice(0, pageSize) : posts;

    return {
      items: pageItems.map((post) => this.toPostView(post)),
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  private toPostView(post: PostWithRelations): PostView {
    return {
      id: post.id,
      authorId: post.authorId,
      groupId: post.groupId,
      content: post.content,
      visibility: post.visibility,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      media: post.media.map((media) => ({
        id: media.id,
        url: media.mediaUrl,
        type: media.mediaType,
        width: media.width,
        height: media.height,
        sortOrder: media.sortOrder,
      })),
      author: {
        id: post.author.id,
        displayName: post.author.profile?.displayName ?? 'Unknown',
        avatarUrl: post.author.profile?.avatarUrl ?? null,
      },
      stats: {
        likeCount: post._count.likes,
        commentCount: post._count.comments,
      },
    };
  }
}
