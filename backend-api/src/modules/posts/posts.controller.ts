import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { PaginatedPostsResponse, PostView, PostsService } from './posts.service';

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
}
