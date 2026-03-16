import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { GroupsController } from '../src/modules/groups/groups.controller';
import { GroupsService } from '../src/modules/groups/groups.service';

describe('GroupsController Integration', () => {
  let app: INestApplication;

  const groupsServiceMock = {
    listGroups: jest.fn().mockResolvedValue({ items: [] }),
    createGroup: jest.fn().mockResolvedValue({
      id: 'g1',
      name: 'General',
      description: null,
      createdAt: '2026-03-16T00:00:00.000Z',
      memberCount: 1,
    }),
    joinGroup: jest.fn().mockResolvedValue({ status: 'ok' }),
    listMembers: jest.fn().mockResolvedValue({ groupId: 'g1', items: [] }),
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
      controllers: [GroupsController],
      providers: [{ provide: GroupsService, useValue: groupsServiceMock }],
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

  it('GET /groups lists groups for organization', async () => {
    await request(app.getHttpServer())
      .get('/groups?organizationId=89ce5ff7-bc2a-4df8-b56b-b8e92f93e928')
      .expect(200);

    expect(groupsServiceMock.listGroups).toHaveBeenCalledWith(
      'u1',
      '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
    );
  });

  it('POST /groups creates a group', async () => {
    const payload = {
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      name: 'General',
    };

    await request(app.getHttpServer()).post('/groups').send(payload).expect(201);

    expect(groupsServiceMock.createGroup).toHaveBeenCalledWith('u1', payload);
  });

  it('POST /groups/:id/join joins an existing group', async () => {
    await request(app.getHttpServer()).post('/groups/g1/join').expect(201);

    expect(groupsServiceMock.joinGroup).toHaveBeenCalledWith('u1', 'g1');
  });

  it('GET /groups/:id/members returns members', async () => {
    await request(app.getHttpServer()).get('/groups/g1/members').expect(200);

    expect(groupsServiceMock.listMembers).toHaveBeenCalledWith('u1', 'g1');
  });
});
