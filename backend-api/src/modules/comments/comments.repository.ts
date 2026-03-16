import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class CommentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  getPostById(postId: string): Promise<{ id: string; authorId: string } | null> {
    return this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
      },
    });
  }

  getCommentById(commentId: string): Promise<
    | {
        id: string;
        postId: string;
        authorId: string;
        parentCommentId: string | null;
        deletedAt: Date | null;
        editedAt: Date | null;
        moderationState: string;
        post: {
          authorId: string;
        };
      }
    | null
  > {
    return this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        authorId: true,
        parentCommentId: true,
        deletedAt: true,
        editedAt: true,
        moderationState: true,
        post: {
          select: {
            authorId: true,
          },
        },
      },
    });
  }

  create(data: Prisma.CommentCreateInput): Promise<
    {
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
    }
  > {
    return this.prisma.comment.create({
      data,
      include: {
        author: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  softDelete(params: {
    commentId: string;
    deletedById: string;
    moderationState: string;
  }): Promise<void> {
    return this.prisma.comment
      .update({
        where: { id: params.commentId },
        data: {
          deletedById: params.deletedById,
          deletedAt: new Date(),
          moderationState: params.moderationState,
          body: '[deleted]',
        },
      })
      .then(() => undefined);
  }

  updateBody(params: { commentId: string; body: string }): Promise<
    {
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
    }
  > {
    return this.prisma.comment.update({
      where: { id: params.commentId },
      data: {
        body: params.body,
        editedAt: new Date(),
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  listByPost(params: {
    postId: string;
    before?: Date;
    take: number;
  }): Promise<
    Array<{
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
    }>
  > {
    return this.prisma.comment.findMany({
      where: {
        postId: params.postId,
        ...(params.before ? { createdAt: { lt: params.before } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });
  }

  createReport(params: {
    commentId: string;
    reporterId: string;
    reason: string;
    details?: string;
  }): Promise<{ id: string }> {
    return this.prisma.commentReport.create({
      data: {
        commentId: params.commentId,
        reporterId: params.reporterId,
        reason: params.reason,
        details: params.details,
      },
      select: {
        id: true,
      },
    });
  }

  findOpenReportByReporter(params: { commentId: string; reporterId: string }): Promise<{ id: string } | null> {
    return this.prisma.commentReport.findFirst({
      where: {
        commentId: params.commentId,
        reporterId: params.reporterId,
        status: 'open',
      },
      select: {
        id: true,
      },
    });
  }

  listReportsForModerator(params: {
    moderatorUserId: string;
    status?: 'open' | 'resolved';
    take: number;
  }): Promise<
    Array<{
      id: string;
      reason: string;
      details: string | null;
      status: string;
      createdAt: Date;
      resolvedAt: Date | null;
      resolutionAction: string | null;
      resolutionNote: string | null;
      comment: {
        id: string;
        postId: string;
        body: string;
        moderationState: string;
        authorId: string;
        post: {
          authorId: string;
        };
      };
      reporter: {
        id: string;
        profile: {
          displayName: string;
          avatarUrl: string | null;
        } | null;
      };
    }>
  > {
    return this.prisma.commentReport.findMany({
      where: {
        comment: {
          post: {
            authorId: params.moderatorUserId,
          },
        },
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: params.take,
      include: {
        comment: {
          include: {
            post: {
              select: {
                authorId: true,
              },
            },
          },
        },
        reporter: {
          include: {
            profile: true,
          },
        },
      },
    });
  }

  findReportById(reportId: string): Promise<
    | {
        id: string;
        status: string;
        comment: {
          id: string;
          post: {
            authorId: string;
          };
        };
      }
    | null
  > {
    return this.prisma.commentReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        status: true,
        comment: {
          select: {
            id: true,
            post: {
              select: {
                authorId: true,
              },
            },
          },
        },
      },
    });
  }

  resolveReport(params: {
    reportId: string;
    resolvedById: string;
    action: string;
    note?: string;
  }): Promise<void> {
    return this.prisma.commentReport
      .update({
        where: { id: params.reportId },
        data: {
          status: 'resolved',
          resolutionAction: params.action,
          resolutionNote: params.note,
          resolvedById: params.resolvedById,
          resolvedAt: new Date(),
        },
      })
      .then(() => undefined);
  }
}
