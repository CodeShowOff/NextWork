import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { IdempotencyService } from '../src/common/reliability/idempotency.service';
import { PostsController } from '../src/modules/posts/posts.controller';
import { PostsService } from '../src/modules/posts/posts.service';

describe('PostsController Integration', () => {
  let app: INestApplication;

  const postsServiceMock = {
    createPost: jest.fn().mockResolvedValue({
      id: 'p1',
      authorId: 'u1',
      groupId: null,
      content: 'Hello phase 3',
      visibility: 'public',
      createdAt: '2026-03-16T00:00:00.000Z',
      updatedAt: '2026-03-16T00:00:00.000Z',
      media: [],
      author: {
        id: 'u1',
        displayName: 'User One',
        avatarUrl: null,
      },
      stats: {
        likeCount: 0,
        commentCount: 0,
      },
    }),
    listPostsByUser: jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    }),
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

  const idempotencyServiceMock = {
    execute: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        { provide: PostsService, useValue: postsServiceMock },
        { provide: IdempotencyService, useValue: idempotencyServiceMock },
      ],
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

  it('POST /posts creates a post for current user', async () => {
    const payload = {
      content: 'Hello phase 3',
      visibility: 'public',
    };

    const response = await request(app.getHttpServer()).post('/posts').send(payload).expect(201);

    expect(response.body.authorId).toBe('u1');
    expect(postsServiceMock.createPost).toHaveBeenCalledWith('u1', payload);
  });

  it('POST /posts passes optional groupId for group-scoped posts', async () => {
    const payload = {
      content: 'Group update',
      visibility: 'public',
      groupId: '00000000-0000-4000-8000-000000000001',
    };

    await request(app.getHttpServer()).post('/posts').send(payload).expect(201);

    expect(postsServiceMock.createPost).toHaveBeenCalledWith('u1', payload);
  });

  it('GET /posts/me returns current user posts', async () => {
    await request(app.getHttpServer()).get('/posts/me?limit=10').expect(200);

    expect(postsServiceMock.listPostsByUser).toHaveBeenCalledWith('u1', 'u1', {
      limit: '10',
    });
  });

  it('GET /posts/user/:userId returns profile posts', async () => {
    await request(app.getHttpServer()).get('/posts/user/u2?before=2026-03-16T01:00:00.000Z').expect(200);

    expect(postsServiceMock.listPostsByUser).toHaveBeenCalledWith('u2', 'u1', {
      before: '2026-03-16T01:00:00.000Z',
    });
  });

  it('GET /posts/me forwards group filter query', async () => {
    await request(app.getHttpServer())
      .get('/posts/me?groupId=00000000-0000-4000-8000-000000000001&limit=5')
      .expect(200);

    expect(postsServiceMock.listPostsByUser).toHaveBeenCalledWith('u1', 'u1', {
      groupId: '00000000-0000-4000-8000-000000000001',
      limit: '5',
    });
  });
});
