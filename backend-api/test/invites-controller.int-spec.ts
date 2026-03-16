import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { InvitesController } from '../src/modules/invites/invites.controller';
import { InvitesService } from '../src/modules/invites/invites.service';

describe('InvitesController Integration', () => {
  let app: INestApplication;

  const invitesServiceMock = {
    createInviteLink: jest.fn().mockResolvedValue({
      id: 'i1',
      token: 'abc123',
      organization: {
        id: 'org-1',
        name: 'Team Alpha',
        slug: 'team-alpha',
      },
      maxUses: null,
      usedCount: 0,
      expiresAt: null,
    }),
    getInviteByToken: jest.fn().mockResolvedValue({
      id: 'i1',
      organization: {
        id: 'org-1',
        name: 'Team Alpha',
        slug: 'team-alpha',
      },
      isExpired: false,
      isRevoked: false,
      isUsageExceeded: false,
      maxUses: null,
      usedCount: 0,
      expiresAt: null,
    }),
    acceptInvite: jest.fn().mockResolvedValue({
      status: 'ok',
      organizationId: 'org-1',
      alreadyMember: false,
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
      controllers: [InvitesController],
      providers: [{ provide: InvitesService, useValue: invitesServiceMock }],
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

  it('POST /invites creates invite link', async () => {
    const payload = {
      organizationId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
      maxUses: 10,
      expiresInHours: 24,
    };

    await request(app.getHttpServer()).post('/invites').send(payload).expect(201);

    expect(invitesServiceMock.createInviteLink).toHaveBeenCalledWith('u1', payload);
  });

  it('GET /invites/:token returns invite details', async () => {
    await request(app.getHttpServer()).get('/invites/abc123').expect(200);

    expect(invitesServiceMock.getInviteByToken).toHaveBeenCalledWith('abc123');
  });

  it('POST /invites/:token/accept accepts an invite', async () => {
    await request(app.getHttpServer()).post('/invites/abc123/accept').expect(201);

    expect(invitesServiceMock.acceptInvite).toHaveBeenCalledWith('u1', 'abc123');
  });
});
