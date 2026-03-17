import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { SearchController } from '../src/modules/search/search.controller';
import { SearchService } from '../src/modules/search/search.service';

describe('SearchController Integration', () => {
  let app: INestApplication;

  const searchServiceMock = {
    search: jest.fn().mockResolvedValue({
      users: [],
      groups: [],
      posts: [],
      pageInfo: {
        usersNextCursor: null,
        groupsNextCursor: null,
        postsNextCursor: null,
      },
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
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: searchServiceMock }],
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

  it('GET /search delegates aggregated query params', async () => {
    await request(app.getHttpServer())
      .get('/search?q=release&limit=10&scope=all&usersCursor=u1&groupsCursor=g1&postsCursor=p1')
      .expect(200);

    expect(searchServiceMock.search).toHaveBeenCalledWith('u1', {
      q: 'release',
      limit: '10',
      scope: 'all',
      usersCursor: 'u1',
      groupsCursor: 'g1',
      postsCursor: 'p1',
    });
  });

  it('GET /search allows scope filtering for posts only', async () => {
    await request(app.getHttpServer()).get('/search?q=release&scope=posts').expect(200);

    expect(searchServiceMock.search).toHaveBeenCalledWith('u1', {
      q: 'release',
      scope: 'posts',
    });
  });
});
