import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { LikesController } from '../src/modules/likes/likes.controller';
import { LikesService } from '../src/modules/likes/likes.service';

describe('LikesController Integration', () => {
  let app: INestApplication;

  const likesServiceMock = {
    likePost: jest.fn().mockResolvedValue({ liked: true, likeCount: 1 }),
    unlikePost: jest.fn().mockResolvedValue({ liked: false, likeCount: 0 }),
    getLikeState: jest.fn().mockResolvedValue({ postId: 'p1', likedByMe: true, likeCount: 3 }),
    listLikers: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
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
      controllers: [LikesController],
      providers: [{ provide: LikesService, useValue: likesServiceMock }],
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

  it('POST /likes/posts/:postId likes a post', async () => {
    await request(app.getHttpServer()).post('/likes/posts/p1').expect(201);

    expect(likesServiceMock.likePost).toHaveBeenCalledWith('u1', 'p1');
  });

  it('DELETE /likes/posts/:postId unlikes a post', async () => {
    await request(app.getHttpServer()).delete('/likes/posts/p1').expect(200);

    expect(likesServiceMock.unlikePost).toHaveBeenCalledWith('u1', 'p1');
  });

  it('GET /likes/posts/:postId returns like state', async () => {
    await request(app.getHttpServer()).get('/likes/posts/p1').expect(200);

    expect(likesServiceMock.getLikeState).toHaveBeenCalledWith('u1', 'p1');
  });

  it('GET /likes/posts/:postId/users lists likers', async () => {
    await request(app.getHttpServer()).get('/likes/posts/p1/users?limit=5').expect(200);

    expect(likesServiceMock.listLikers).toHaveBeenCalledWith('p1', { limit: '5' });
  });
});
