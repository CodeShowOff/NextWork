import { Injectable } from '@nestjs/common';

import { CacheService } from '../../common/cache/cache.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedRepository } from './feed.repository';
import { PaginatedPostsResponse, PostsService } from '../posts/posts.service';

@Injectable()
export class FeedService {
  constructor(
    private readonly feedRepository: FeedRepository,
    private readonly postsService: PostsService,
    private readonly cacheService: CacheService,
  ) {}

  async getFeedForUser(userId: string, query: FeedQueryDto): Promise<PaginatedPostsResponse> {
    const cacheKey = `feed:${userId}:limit=${query.limit ?? 20}:before=${query.before ?? 'none'}:groupId=${query.groupId ?? 'none'}`;
    const cached = await this.cacheService.getJson<PaginatedPostsResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const followeeIds = await this.feedRepository.getFolloweeIdsForUser(userId);
    const groupIds = await this.feedRepository.getGroupIdsForUser(userId);
    const feedAuthorIds = Array.from(new Set([...followeeIds, userId]));

    const response = await this.postsService.listFeedPosts(userId, feedAuthorIds, groupIds, query);
    await this.cacheService.setJson(cacheKey, response, 30);
    return response;
  }
}
