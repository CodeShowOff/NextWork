import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedService } from './feed.service';
import { PaginatedPostsResponse } from '../posts/posts.service';

@Controller('feed')
@UseGuards(JwtAuthGuard)
@ApiTags('feed')
@ApiBearerAuth('access-token')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @ApiOperation({ summary: 'Get personalized feed', description: 'Returns follow and group-scoped posts.' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiQuery({ name: 'groupId', required: false, type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Paginated feed response' })
  getFeed(
    @CurrentUser() user: JwtPayload,
    @Query() query: FeedQueryDto,
  ): Promise<PaginatedPostsResponse> {
    return this.feedService.getFeedForUser(user.sub, query);
  }
}
