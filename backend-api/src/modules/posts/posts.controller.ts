import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { IdempotencyService } from '../../common/reliability/idempotency.service';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { VotePollDto } from './dto/vote-poll.dto';
import { PaginatedPostsResponse, PostShareLinkView, PostView, PostsService } from './posts.service';

@Controller('posts')
@UseGuards(JwtAuthGuard)
@ApiTags('posts')
@ApiBearerAuth('access-token')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create post', description: 'Creates a personal or group-scoped post.' })
  @ApiBody({ type: CreatePostDto })
  @ApiOkResponse({ description: 'Created post payload' })
  createPost(
    @CurrentUser() user: JwtPayload,
    @Body() payload: CreatePostDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PostView> {
    if (idempotencyKey?.trim()) {
      return this.idempotencyService.execute({
        scope: 'create-post',
        userId: user.sub,
        idempotencyKey: idempotencyKey.trim(),
        ttlSeconds: 3600,
        run: () => this.postsService.createPost(user.sub, payload),
      });
    }

    return this.postsService.createPost(user.sub, payload);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my posts' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiQuery({ name: 'groupId', required: false, type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Paginated posts authored by current user' })
  getMyPosts(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListPostsQueryDto,
  ): Promise<PaginatedPostsResponse> {
    return this.postsService.listPostsByUser(user.sub, user.sub, query);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'List posts by user' })
  @ApiParam({ name: 'userId', type: String, format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiQuery({ name: 'groupId', required: false, type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Paginated posts authored by selected user' })
  getPostsByUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Query() query: ListPostsQueryDto,
  ): Promise<PaginatedPostsResponse> {
    return this.postsService.listPostsByUser(userId, user.sub, query);
  }

  @Patch(':postId')
  @ApiOperation({ summary: 'Update post', description: 'Updates post content or visibility for the author.' })
  @ApiParam({ name: 'postId', type: String, format: 'uuid' })
  @ApiBody({ type: UpdatePostDto })
  @ApiOkResponse({ description: 'Updated post payload' })
  updatePost(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
    @Body() payload: UpdatePostDto,
  ): Promise<PostView> {
    return this.postsService.updatePost(user.sub, postId, payload);
  }

  @Delete(':postId')
  @ApiOperation({ summary: 'Delete post', description: 'Deletes a post owned by the current user.' })
  @ApiParam({ name: 'postId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Delete result status' })
  deletePost(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ): Promise<{ status: 'ok' }> {
    return this.postsService.deletePost(user.sub, postId);
  }

  @Get(':postId/share-link')
  @ApiOperation({ summary: 'Get post share link', description: 'Returns web and app links for post sharing.' })
  @ApiParam({ name: 'postId', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Post share links' })
  getShareLink(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
  ): Promise<PostShareLinkView> {
    return this.postsService.getPostShareLink(user.sub, postId);
  }

  @Post(':postId/poll/vote')
  @ApiOperation({ summary: 'Vote in post poll', description: 'Creates or updates current user poll vote on a post.' })
  @ApiParam({ name: 'postId', type: String, format: 'uuid' })
  @ApiBody({ type: VotePollDto })
  @ApiOkResponse({ description: 'Updated post payload including poll stats' })
  votePoll(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
    @Body() payload: VotePollDto,
  ): Promise<PostView> {
    return this.postsService.votePoll(user.sub, postId, payload.optionId);
  }
}
