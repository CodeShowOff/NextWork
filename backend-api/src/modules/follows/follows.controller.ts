import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ListFollowsQueryDto } from './dto/list-follows-query.dto';
import { FollowsService } from './follows.service';

@Controller('follows')
@UseGuards(JwtAuthGuard)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId')
  followUser(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return this.followsService.followUser(user.sub, userId);
  }

  @Delete(':userId')
  unfollowUser(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return this.followsService.unfollowUser(user.sub, userId);
  }

  @Get(':userId/status')
  getRelationship(@CurrentUser() user: JwtPayload, @Param('userId') userId: string) {
    return this.followsService.getRelationship(user.sub, userId);
  }

  @Get(':userId/followers')
  listFollowers(@Param('userId') userId: string, @Query() query: ListFollowsQueryDto) {
    return this.followsService.listFollowers(userId, query);
  }

  @Get(':userId/following')
  listFollowing(@Param('userId') userId: string, @Query() query: ListFollowsQueryDto) {
    return this.followsService.listFollowing(userId, query);
  }
}
