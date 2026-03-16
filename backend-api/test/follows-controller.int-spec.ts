import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { FollowsController } from '../src/modules/follows/follows.controller';
import { FollowsService } from '../src/modules/follows/follows.service';

describe('FollowsController Integration', () => {
  let app: INestApplication;

  const followsServiceMock = {
    followUser: jest.fn().mockResolvedValue({ isFollowing: true }),
    unfollowUser: jest.fn().mockResolvedValue({ isFollowing: false }),
    getRelationship: jest.fn().mockResolvedValue({
      isFollowing: true,
      followersCount: 12,
      followingCount: 5,
    }),
    listFollowers: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    listFollowing: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
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
      controllers: [FollowsController],
      providers: [{ provide: FollowsService, useValue: followsServiceMock }],
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

  it('POST /follows/:userId follows a target user', async () => {
    await request(app.getHttpServer()).post('/follows/u2').expect(201);

    expect(followsServiceMock.followUser).toHaveBeenCalledWith('u1', 'u2');
  });

  it('DELETE /follows/:userId unfollows a target user', async () => {
    await request(app.getHttpServer()).delete('/follows/u2').expect(200);

    expect(followsServiceMock.unfollowUser).toHaveBeenCalledWith('u1', 'u2');
  });

  it('GET /follows/:userId/status returns relationship and counters', async () => {
    await request(app.getHttpServer()).get('/follows/u2/status').expect(200);

    expect(followsServiceMock.getRelationship).toHaveBeenCalledWith('u1', 'u2');
  });

  it('GET /follows/:userId/followers paginates followers', async () => {
    await request(app.getHttpServer()).get('/follows/u2/followers?limit=10').expect(200);

    expect(followsServiceMock.listFollowers).toHaveBeenCalledWith('u2', { limit: '10' });
  });

  it('GET /follows/:userId/following paginates following users', async () => {
    await request(app.getHttpServer()).get('/follows/u2/following?before=2026-03-16T02:00:00.000Z').expect(200);

    expect(followsServiceMock.listFollowing).toHaveBeenCalledWith('u2', {
      before: '2026-03-16T02:00:00.000Z',
    });
  });
});
