import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { CommentsController } from '../src/modules/comments/comments.controller';
import { CommentsService } from '../src/modules/comments/comments.service';

describe('CommentsController Integration', () => {
  let app: INestApplication;

  const commentsServiceMock = {
    createComment: jest.fn().mockResolvedValue({
      id: 'c1',
      postId: 'p1',
      parentCommentId: null,
      body: 'Nice post',
      createdAt: '2026-03-16T00:00:00.000Z',
      author: {
        id: 'u1',
        displayName: 'User One',
        avatarUrl: null,
      },
      stats: {
        replyCount: 0,
      },
    }),
    deleteComment: jest.fn().mockResolvedValue({ deleted: true }),
    updateComment: jest.fn().mockResolvedValue({
      id: 'c1',
      postId: 'p1',
      parentCommentId: null,
      body: 'Edited',
      createdAt: '2026-03-16T00:00:00.000Z',
      editedAt: '2026-03-16T00:01:00.000Z',
      deletedAt: null,
      moderationState: 'active',
      author: {
        id: 'u1',
        displayName: 'User One',
        avatarUrl: null,
      },
      stats: {
        replyCount: 0,
      },
    }),
    listComments: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    reportComment: jest.fn().mockResolvedValue({ status: 'reported', reportId: 'r1' }),
    listCommentReports: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    resolveCommentReport: jest.fn().mockResolvedValue({ status: 'ok' }),
  };

  const authGuardMock = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = {
        sub: 'u1',
        email: 'user@example.com',
        type: 'access',
      };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: commentsServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuardMock)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /comments/posts/:postId creates comment', async () => {
    const payload = { body: 'Nice post' };

    await request(app.getHttpServer()).post('/comments/posts/p1').send(payload).expect(201);

    expect(commentsServiceMock.createComment).toHaveBeenCalledWith('u1', 'p1', payload);
  });

  it('DELETE /comments/:commentId deletes own comment', async () => {
    await request(app.getHttpServer()).delete('/comments/c1').expect(200);

    expect(commentsServiceMock.deleteComment).toHaveBeenCalledWith('u1', 'c1');
  });

  it('PATCH /comments/:commentId updates own comment', async () => {
    const payload = { body: 'Edited' };

    await request(app.getHttpServer()).patch('/comments/c1').send(payload).expect(200);

    expect(commentsServiceMock.updateComment).toHaveBeenCalledWith('u1', 'c1', payload);
  });

  it('POST /comments/:commentId/report reports comment', async () => {
    const payload = { reason: 'spam', details: 'Repeated unsolicited links' };

    await request(app.getHttpServer()).post('/comments/c1/report').send(payload).expect(201);

    expect(commentsServiceMock.reportComment).toHaveBeenCalledWith('u1', 'c1', payload);
  });

  it('GET /comments/reports returns moderation queue for current user', async () => {
    await request(app.getHttpServer()).get('/comments/reports?status=open&limit=20').expect(200);

    expect(commentsServiceMock.listCommentReports).toHaveBeenCalledWith('u1', {
      status: 'open',
      limit: '20',
    });
  });

  it('POST /comments/reports/:reportId/resolve resolves a report', async () => {
    const payload = { action: 'dismiss' };

    await request(app.getHttpServer()).post('/comments/reports/r1/resolve').send(payload).expect(201);

    expect(commentsServiceMock.resolveCommentReport).toHaveBeenCalledWith('u1', 'r1', payload);
  });

  it('GET /comments/posts/:postId lists comments', async () => {
    await request(app.getHttpServer()).get('/comments/posts/p1?limit=20').expect(200);

    expect(commentsServiceMock.listComments).toHaveBeenCalledWith('p1', { limit: '20' });
  });
});
