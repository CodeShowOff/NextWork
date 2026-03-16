import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ListLikesQueryDto } from './dto/list-likes-query.dto';
import { LikesService } from './likes.service';

@Controller('likes')
@UseGuards(JwtAuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post('posts/:postId')
  likePost(@CurrentUser() user: JwtPayload, @Param('postId') postId: string) {
    return this.likesService.likePost(user.sub, postId);
  }

  @Delete('posts/:postId')
  unlikePost(@CurrentUser() user: JwtPayload, @Param('postId') postId: string) {
    return this.likesService.unlikePost(user.sub, postId);
  }

  @Get('posts/:postId')
  getLikeState(@CurrentUser() user: JwtPayload, @Param('postId') postId: string) {
    return this.likesService.getLikeState(user.sub, postId);
  }

  @Get('posts/:postId/users')
  listLikers(@Param('postId') postId: string, @Query() query: ListLikesQueryDto) {
    return this.likesService.listLikers(postId, query);
  }
}
