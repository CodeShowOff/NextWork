import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

interface ProfileUpdatePayload {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { ProfilesController } from '../src/modules/profiles/profiles.controller';
import { ProfilesService } from '../src/modules/profiles/profiles.service';

describe('ProfilesController Integration', () => {
  let app: INestApplication;

  const profilesServiceMock = {
    findByUserId: jest.fn().mockImplementation(async (userId: string) => ({
      userId,
      displayName: 'Profile User',
      bio: 'Hello',
      avatarUrl: 'https://example.com/avatar.png',
      jobTitle: null,
      organizationSize: null,
      createdAt: '2026-03-16T00:00:00.000Z',
      updatedAt: '2026-03-16T00:00:00.000Z',
      counters: {
        posts: 4,
        followers: 10,
        following: 3,
        groupsFollowed: 2,
        skillsEntries: 0,
      },
      relationship: {
        isFollowing: false,
      },
    })),
    updateMyProfile: jest
      .fn()
      .mockImplementation(async (userId: string, payload: ProfileUpdatePayload) => ({
      userId,
      displayName: payload.displayName ?? 'Profile User',
      bio: payload.bio ?? 'Hello',
      avatarUrl: payload.avatarUrl ?? 'https://example.com/avatar.png',
      })),
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
      controllers: [ProfilesController],
      providers: [{ provide: ProfilesService, useValue: profilesServiceMock }],
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

  it('GET /profiles/:userId returns profile data', async () => {
    const response = await request(app.getHttpServer()).get('/profiles/u2').expect(200);

    expect(response.body.userId).toBe('u2');
    expect(profilesServiceMock.findByUserId).toHaveBeenCalledWith('u2', 'u1');
  });

  it('PATCH /profiles/me updates profile using current user', async () => {
    const payload = {
      displayName: 'Updated Name',
      bio: 'Updated Bio',
    };

    const response = await request(app.getHttpServer())
      .patch('/profiles/me')
      .send(payload)
      .expect(200);

    expect(response.body.displayName).toBe('Updated Name');
    expect(profilesServiceMock.updateMyProfile).toHaveBeenCalledWith('u1', payload);
  });
});
