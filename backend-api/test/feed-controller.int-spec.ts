import { ExecutionContext, ForbiddenException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { FeedController } from '../src/modules/feed/feed.controller';
import { FeedService } from '../src/modules/feed/feed.service';

describe('FeedController Integration', () => {
  let app: INestApplication;

  const feedServiceMock = {
    getFeedForUser: jest.fn().mockResolvedValue({
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

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [{ provide: FeedService, useValue: feedServiceMock }],
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

  it('GET /feed returns follow-based feed for current user', async () => {
    await request(app.getHttpServer()).get('/feed?limit=15').expect(200);

    expect(feedServiceMock.getFeedForUser).toHaveBeenCalledWith('u1', {
      limit: '15',
    });
  });

  it('GET /feed forwards group-scoped feed query params', async () => {
    await request(app.getHttpServer())
      .get('/feed?limit=10&groupId=00000000-0000-4000-8000-000000000001&before=2026-03-16T02:00:00.000Z')
      .expect(200);

    expect(feedServiceMock.getFeedForUser).toHaveBeenCalledWith('u1', {
      limit: '10',
      groupId: '00000000-0000-4000-8000-000000000001',
      before: '2026-03-16T02:00:00.000Z',
    });
  });

  it('GET /feed returns 403 for unauthorized group feed access', async () => {
    feedServiceMock.getFeedForUser.mockRejectedValueOnce(new ForbiddenException('Not a member of this group'));

    await request(app.getHttpServer())
      .get('/feed?groupId=00000000-0000-4000-8000-000000000009')
      .expect(403);
  });
});
