import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { JwtPayload } from '../../common/auth/jwt-payload.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RateLimit } from '../../common/reliability/rate-limit.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentReportDto } from './dto/create-comment-report.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentReportsQueryDto } from './dto/list-comment-reports-query.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { ResolveCommentReportDto } from './dto/resolve-comment-report.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:postId')
  @RateLimit(50, 60)
  createComment(
    @CurrentUser() user: JwtPayload,
    @Param('postId') postId: string,
    @Body() payload: CreateCommentDto,
  ) {
    return this.commentsService.createComment(user.sub, postId, payload);
  }

  @Patch(':commentId')
  @RateLimit(40, 60)
  updateComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() payload: UpdateCommentDto,
  ) {
    return this.commentsService.updateComment(user.sub, commentId, payload);
  }

  @Delete(':commentId')
  deleteComment(@CurrentUser() user: JwtPayload, @Param('commentId') commentId: string) {
    return this.commentsService.deleteComment(user.sub, commentId);
  }

  @Post(':commentId/report')
  @RateLimit(20, 60)
  reportComment(
    @CurrentUser() user: JwtPayload,
    @Param('commentId') commentId: string,
    @Body() payload: CreateCommentReportDto,
  ) {
    return this.commentsService.reportComment(user.sub, commentId, payload);
  }

  @Get('reports')
  listReports(@CurrentUser() user: JwtPayload, @Query() query: ListCommentReportsQueryDto) {
    return this.commentsService.listCommentReports(user.sub, query);
  }

  @Post('reports/:reportId/resolve')
  @RateLimit(30, 60)
  resolveReport(
    @CurrentUser() user: JwtPayload,
    @Param('reportId') reportId: string,
    @Body() payload: ResolveCommentReportDto,
  ) {
    return this.commentsService.resolveCommentReport(user.sub, reportId, payload);
  }

  @Get('posts/:postId')
  listComments(@Param('postId') postId: string, @Query() query: ListCommentsQueryDto) {
    return this.commentsService.listComments(postId, query);
  }
}
