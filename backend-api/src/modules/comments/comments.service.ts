import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { NotificationsService } from '../notifications/notifications.service';
import { CreateCommentReportDto } from './dto/create-comment-report.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentReportsQueryDto } from './dto/list-comment-reports-query.dto';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';
import { ResolveCommentReportDto } from './dto/resolve-comment-report.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentsRepository } from './comments.repository';

export interface CommentView {
  id: string;
  postId: string;
  parentCommentId: string | null;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  moderationState: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  stats: {
    replyCount: number;
  };
}

export interface PaginatedComments {
  items: CommentView[];
  nextCursor: string | null;
}

export interface CommentReportView {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionAction: string | null;
  resolutionNote: string | null;
  reporter: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  comment: {
    id: string;
    postId: string;
    body: string;
    moderationState: string;
    authorId: string;
  };
}

export interface PaginatedCommentReports {
  items: CommentReportView[];
  nextCursor: string | null;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly commentsRepository: CommentsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createComment(userId: string, postId: string, payload: CreateCommentDto): Promise<CommentView> {
    const post = await this.commentsRepository.getPostById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (payload.parentCommentId) {
      const parent = await this.commentsRepository.getCommentById(payload.parentCommentId);
      if (!parent || parent.postId !== postId) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const comment = await this.commentsRepository.create({
      body: payload.body,
      post: {
        connect: { id: postId },
      },
      author: {
        connect: { id: userId },
      },
      ...(payload.parentCommentId
        ? {
            parentComment: {
              connect: { id: payload.parentCommentId },
            },
          }
        : {}),
    });

    await this.notificationsService.createNotification({
      userId: post.authorId,
      actorId: userId,
      type: 'comment',
      entityType: 'post',
      entityId: postId,
    });

    return this.toCommentView({ ...comment, _count: { replies: 0 } });
  }

  async updateComment(userId: string, commentId: string, payload: UpdateCommentDto): Promise<CommentView> {
    const comment = await this.commentsRepository.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.deletedAt) {
      throw new ForbiddenException('Cannot edit a deleted comment');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('Not allowed to edit this comment');
    }

    const updated = await this.commentsRepository.updateBody({
      commentId,
      body: payload.body,
    });

    return this.toCommentView({ ...updated, _count: { replies: 0 } });
  }

  async deleteComment(userId: string, commentId: string): Promise<{ deleted: true }> {
    const comment = await this.commentsRepository.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('Not allowed to delete this comment');
    }

    if (comment.deletedAt) {
      return { deleted: true };
    }

    await this.commentsRepository.softDelete({
      commentId,
      deletedById: userId,
      moderationState: 'removed_by_author',
    });
    return { deleted: true };
  }

  async listComments(postId: string, query: ListCommentsQueryDto): Promise<PaginatedComments> {
    const post = await this.commentsRepository.getPostById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const pageSize = query.limit ?? 20;
    const rows = await this.commentsRepository.listByPost({
      postId,
      before: query.before ? new Date(query.before) : undefined,
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      items: items.map((comment) => ({
        ...this.toCommentView(comment),
      })),
      nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() ?? null : null,
    };
  }

  async reportComment(
    userId: string,
    commentId: string,
    payload: CreateCommentReportDto,
  ): Promise<{ status: 'reported' | 'already_reported'; reportId?: string }> {
    const comment = await this.commentsRepository.getCommentById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId === userId) {
      return { status: 'already_reported' };
    }

    const existing = await this.commentsRepository.findOpenReportByReporter({
      commentId,
      reporterId: userId,
    });

    if (existing) {
      return {
        status: 'already_reported',
        reportId: existing.id,
      };
    }

    const report = await this.commentsRepository.createReport({
      commentId,
      reporterId: userId,
      reason: payload.reason,
      details: payload.details,
    });

    return {
      status: 'reported',
      reportId: report.id,
    };
  }

  async listCommentReports(
    userId: string,
    query: ListCommentReportsQueryDto,
  ): Promise<PaginatedCommentReports> {
    const pageSize = query.limit ?? 20;
    const statusFilter = query.status === 'all' || !query.status ? undefined : query.status;

    const rows = await this.commentsRepository.listReportsForModerator({
      moderatorUserId: userId,
      status: statusFilter,
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const items = hasMore ? rows.slice(0, pageSize) : rows;

    return {
      items: items.map((row) => ({
        id: row.id,
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
        resolutionAction: row.resolutionAction,
        resolutionNote: row.resolutionNote,
        reporter: {
          id: row.reporter.id,
          displayName: row.reporter.profile?.displayName ?? 'Unknown',
          avatarUrl: row.reporter.profile?.avatarUrl ?? null,
        },
        comment: {
          id: row.comment.id,
          postId: row.comment.postId,
          body: row.comment.body,
          moderationState: row.comment.moderationState,
          authorId: row.comment.authorId,
        },
      })),
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  }

  async resolveCommentReport(
    userId: string,
    reportId: string,
    payload: ResolveCommentReportDto,
  ): Promise<{ status: 'ok' }> {
    const report = await this.commentsRepository.findReportById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.comment.post.authorId !== userId) {
      throw new ForbiddenException('Not allowed to resolve this report');
    }

    if (report.status === 'resolved') {
      return { status: 'ok' };
    }

    if (payload.action === 'remove_comment') {
      await this.commentsRepository.softDelete({
        commentId: report.comment.id,
        deletedById: userId,
        moderationState: 'removed_by_moderator',
      });
    }

    await this.commentsRepository.resolveReport({
      reportId,
      resolvedById: userId,
      action: payload.action,
      note: payload.note,
    });

    return { status: 'ok' };
  }

  private toCommentView(comment: {
    id: string;
    postId: string;
    parentCommentId: string | null;
    body: string;
    createdAt: Date;
    editedAt: Date | null;
    deletedAt: Date | null;
    moderationState: string;
    author: {
      id: string;
      profile: {
        displayName: string;
        avatarUrl: string | null;
      } | null;
    };
    _count: {
      replies: number;
    };
  }): CommentView {
    return {
      id: comment.id,
      postId: comment.postId,
      parentCommentId: comment.parentCommentId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      editedAt: comment.editedAt ? comment.editedAt.toISOString() : null,
      deletedAt: comment.deletedAt ? comment.deletedAt.toISOString() : null,
      moderationState: comment.moderationState,
      author: {
        id: comment.author.id,
        displayName: comment.author.profile?.displayName ?? 'Unknown',
        avatarUrl: comment.author.profile?.avatarUrl ?? null,
      },
      stats: {
        replyCount: comment._count.replies,
      },
    };
  }
}
