import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { BackgroundJobsService } from '../../common/reliability/background-jobs.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostWithRelations, PostsRepository } from './posts.repository';

export interface PostMediaView {
  id: string;
  mediaId: string | null;
  url: string | null;
  type: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
}

interface PollOptionStored {
  id: string;
  text: string;
}

interface PollStored {
  question: string;
  options: PollOptionStored[];
}

export interface PostPollView {
  question: string;
  options: Array<{
    id: string;
    text: string;
    voteCount: number;
  }>;
  totalVotes: number;
  votedOptionId: string | null;
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
  taggedUserIds: string[];
  hashtags: string[];
  poll: PostPollView | null;
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

export interface PostShareLinkView {
  postId: string;
  shareUrl: string;
  appUrl: string;
}

@Injectable()
export class PostsService {
  private readonly tagsMediaType = 'application/x-workplace-tags+json';
  private readonly pollMediaType = 'application/x-workplace-poll+json';
  private readonly pollVoteMediaType = 'application/x-workplace-poll-vote';

  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly backgroundJobsService: BackgroundJobsService,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createPost(userId: string, payload: CreatePostDto): Promise<PostView> {
    if (payload.groupId) {
      const group = await this.postsRepository.findGroupById(payload.groupId);
      if (!group) {
        throw new NotFoundException('Group not found');
      }

      const isMember = await this.postsRepository.isGroupMemberOrOrganizationAdmin(userId, payload.groupId);
      if (!isMember) {
        throw new ForbiddenException('Not a member of this group');
      }
    }

    await this.assertPostMediaBelongToAuthor(userId, payload.groupId, payload.media);

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
                mediaUrl: item.mediaId ? `media://${item.mediaId}` : item.url!,
                ...(item.mediaId
                  ? {
                      mediaObject: {
                        connect: { id: item.mediaId },
                      },
                    }
                  : {}),
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

    const hashtagSet = new Set(this.extractHashtags(payload.content));

    if (payload.taggedUserIds?.length) {
      await Promise.all(
        payload.taggedUserIds.map((taggedUserId) =>
          this.notificationsService.createNotification({
            userId: taggedUserId,
            actorId: userId,
            type: 'comment',
            entityType: 'post',
            entityId: post.id,
          }),
        ),
      );
    }

    if (payload.taggedUserIds?.length || hashtagSet.size) {
      await this.postsRepository.addPostMetadata(
        post.id,
        this.tagsMediaType,
        JSON.stringify({
          taggedUserIds: payload.taggedUserIds ?? [],
          hashtags: [...hashtagSet],
        }),
      );
    }

    if (payload.poll) {
      const poll: PollStored = {
        question: payload.poll.question,
        options: payload.poll.options.map((option, index) => ({
          id: `opt_${index + 1}`,
          text: option.text,
        })),
      };

      await this.postsRepository.addPostMetadata(post.id, this.pollMediaType, JSON.stringify(poll));
    }

    const postWithMetadata = await this.postsRepository.findById(post.id);
    if (!postWithMetadata) {
      throw new NotFoundException('Post not found after creation');
    }

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

    return this.toPostView(postWithMetadata, userId);
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

    return this.toPaginatedResult(posts, query.limit ?? 20, viewerId);
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

    return this.toPaginatedResult(posts, query.limit ?? 20, viewerId);
  }

  async updatePost(userId: string, postId: string, payload: UpdatePostDto): Promise<PostView> {
    const existing = await this.postsRepository.findById(postId);
    if (!existing) {
      throw new NotFoundException('Post not found');
    }

    if (existing.authorId !== userId) {
      throw new ForbiddenException('Not allowed to edit this post');
    }

    const hasUpdate = payload.content !== undefined || payload.visibility !== undefined;
    if (!hasUpdate) {
      return this.toPostView(existing, userId);
    }

    const updated = await this.postsRepository.updateById(postId, {
      ...(payload.content !== undefined ? { content: payload.content } : {}),
      ...(payload.visibility !== undefined ? { visibility: payload.visibility } : {}),
    });

    await this.invalidateImpactedFeeds(existing);
    return this.toPostView(updated, userId);
  }

  async deletePost(userId: string, postId: string): Promise<{ status: 'ok' }> {
    const existing = await this.postsRepository.findById(postId);
    if (!existing) {
      throw new NotFoundException('Post not found');
    }

    if (existing.authorId !== userId) {
      throw new ForbiddenException('Not allowed to delete this post');
    }

    await this.postsRepository.deleteById(postId);
    await this.mediaService.deleteOwnedMediaObjects(
      userId,
      existing.media.flatMap((item) => (item.mediaObjectId ? [item.mediaObjectId] : [])),
    );
    await this.invalidateImpactedFeeds(existing);
    return { status: 'ok' };
  }

  async getPost(viewerId: string, postId: string): Promise<PostView> {
    const post = await this.postsRepository.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    await this.assertCanViewPost(viewerId, post);
    return this.toPostView(post, viewerId);
  }

  async getPostShareLink(viewerId: string, postId: string): Promise<PostShareLinkView> {
    const post = await this.postsRepository.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.assertCanViewPost(viewerId, post);

    const base = (process.env.POST_SHARE_BASE_URL ?? 'https://workplace.app/post').replace(/\/+$/, '');

    return {
      postId,
      shareUrl: `${base}/${postId}`,
      appUrl: `workplace://post/${postId}`,
    };
  }

  async votePoll(userId: string, postId: string, optionId: string): Promise<PostView> {
    const post = await this.postsRepository.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.assertCanViewPost(userId, post);

    const poll = this.parsePoll(post.media);
    if (!poll) {
      throw new NotFoundException('Poll not found for this post');
    }

    if (!poll.options.some((option) => option.id === optionId)) {
      throw new NotFoundException('Poll option not found');
    }

    await this.postsRepository.replacePollVote(postId, userId, optionId, this.pollVoteMediaType);

    const updated = await this.postsRepository.findById(postId);
    if (!updated) {
      throw new NotFoundException('Post not found');
    }

    await this.invalidateImpactedFeeds(updated);
    return this.toPostView(updated, userId);
  }

  private async assertPostMediaBelongToAuthor(
    userId: string,
    groupId: string | undefined,
    media?: Array<{ mediaId?: string; url?: string }>,
  ): Promise<void> {
    if (!media?.length) {
      return;
    }

    await Promise.all(
      media.map(async (item) => {
        if (item.mediaId) {
          await this.mediaService.assertMediaObjectAvailableForPost(userId, groupId, item.mediaId);
          return;
        }
        if (!item.url || !this.mediaService.isPublicMediaUrlAllowed(userId, item.url)) {
          throw new ForbiddenException('Media URL is not permitted for this author');
        }
      }),
    );
  }

  private toPaginatedResult(
    posts: PostWithRelations[],
    pageSize: number,
    viewerId: string,
  ): PaginatedPostsResponse {
    const hasMore = posts.length > pageSize;
    const pageItems = hasMore ? posts.slice(0, pageSize) : posts;

    return {
      items: pageItems.map((post) => this.toPostView(post, viewerId)),
      nextCursor: hasMore ? pageItems[pageItems.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  private toPostView(post: PostWithRelations, viewerId: string): PostView {
    const contentHashtags = this.extractHashtags(post.content);
    const tagMeta = this.parseTags(post.media);
    const poll = this.parsePoll(post.media);
    const pollVotes = this.parsePollVotes(post.media);
    const media = post.media.filter(
      (item) =>
        item.mediaType !== this.tagsMediaType &&
        item.mediaType !== this.pollMediaType &&
        item.mediaType !== this.pollVoteMediaType,
    );

    const pollView: PostPollView | null = poll
      ? {
          question: poll.question,
          options: poll.options.map((option) => ({
            id: option.id,
            text: option.text,
            voteCount: pollVotes.filter((vote) => vote.optionId === option.id).length,
          })),
          totalVotes: pollVotes.length,
          votedOptionId: pollVotes.find((vote) => vote.userId === viewerId)?.optionId ?? null,
        }
      : null;

    const hashtagSet = new Set([...(tagMeta?.hashtags ?? []), ...contentHashtags]);

    return {
      id: post.id,
      authorId: post.authorId,
      groupId: post.groupId,
      content: post.content,
      visibility: post.visibility,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      media: media.map((mediaItem) => ({
        id: mediaItem.id,
        mediaId: mediaItem.mediaObjectId,
        url: mediaItem.mediaObjectId ? null : mediaItem.mediaUrl,
        type: mediaItem.mediaType,
        width: mediaItem.width,
        height: mediaItem.height,
        sortOrder: mediaItem.sortOrder,
      })),
      taggedUserIds: tagMeta?.taggedUserIds ?? [],
      hashtags: [...hashtagSet],
      poll: pollView,
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

  private parseTags(media: PostWithRelations['media']): { taggedUserIds: string[]; hashtags: string[] } | null {
    const tagMetadata = media.find((item) => item.mediaType === this.tagsMediaType);
    if (!tagMetadata) {
      return null;
    }

    try {
      const parsed = JSON.parse(tagMetadata.mediaUrl) as {
        taggedUserIds?: string[];
        hashtags?: string[];
      };

      return {
        taggedUserIds: parsed.taggedUserIds ?? [],
        hashtags: parsed.hashtags ?? [],
      };
    } catch {
      return null;
    }
  }

  private parsePoll(media: PostWithRelations['media']): PollStored | null {
    const pollMetadata = media.find((item) => item.mediaType === this.pollMediaType);
    if (!pollMetadata) {
      return null;
    }

    try {
      return JSON.parse(pollMetadata.mediaUrl) as PollStored;
    } catch {
      return null;
    }
  }

  private parsePollVotes(media: PostWithRelations['media']): Array<{ userId: string; optionId: string }> {
    return media
      .filter((item) => item.mediaType === this.pollVoteMediaType)
      .map((item) => item.mediaUrl)
      .map((value) => {
        const [userId, optionId] = value.split('|');
        return { userId, optionId };
      })
      .filter((vote) => Boolean(vote.userId) && Boolean(vote.optionId));
  }

  private extractHashtags(content: string): string[] {
    const matches = content.match(/#[a-zA-Z0-9_]+/g) ?? [];
    return matches.map((tag) => tag.toLowerCase());
  }

  private async assertCanViewPost(viewerId: string, post: PostWithRelations): Promise<void> {
    if (post.authorId === viewerId) {
      return;
    }

    if (post.groupId) {
      const isMember = await this.postsRepository.isGroupMemberOrOrganizationAdmin(viewerId, post.groupId);
      if (!isMember) {
        throw new ForbiddenException('Not allowed to view this post');
      }
      return;
    }

    if (post.visibility === 'private') {
      throw new ForbiddenException('Not allowed to view this post');
    }

    if (post.visibility === 'followers') {
      const isFollower = await this.postsRepository.isFollower(viewerId, post.authorId);
      if (!isFollower) {
        throw new ForbiddenException('Not allowed to view this post');
      }
    }
  }

  private async invalidateImpactedFeeds(post: PostWithRelations): Promise<void> {
    const impactedUsers = new Set<string>([
      post.authorId,
      ...(await this.postsRepository.listFollowerIds(post.authorId)),
    ]);

    if (post.groupId) {
      const groupMemberIds = await this.postsRepository.listGroupMemberIds(post.groupId);
      for (const memberId of groupMemberIds) {
        impactedUsers.add(memberId);
      }
    }

    await Promise.all(
      [...impactedUsers].map((impactedUserId) =>
        this.backgroundJobsService.enqueueCachePrefixInvalidation(`feed:${impactedUserId}:`),
      ),
    );
  }
}
