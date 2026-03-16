import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { NotificationsController } from '../src/modules/notifications/notifications.controller';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('NotificationsController Integration', () => {
  let app: INestApplication;

  const notificationsServiceMock = {
    listForUser: jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    }),
    getUnreadCount: jest.fn().mockResolvedValue({
      unreadCount: 2,
    }),
    markRead: jest.fn().mockResolvedValue({
      status: 'ok',
    }),
    markAllRead: jest.fn().mockResolvedValue({
      status: 'ok',
      updated: 2,
    }),
    getPreferences: jest.fn().mockResolvedValue({
      likeEnabled: true,
      commentEnabled: true,
      followEnabled: true,
      messageEnabled: true,
    }),
    updatePreferences: jest.fn().mockResolvedValue({
      likeEnabled: false,
      commentEnabled: true,
      followEnabled: true,
      messageEnabled: true,
    }),
    listMutedActors: jest.fn().mockResolvedValue({
      items: [
        {
          userId: '9f2f3161-26bc-4f6a-a57d-a4eb9f9ad99f',
          displayName: 'Muted User',
          avatarUrl: null,
        },
      ],
    }),
    muteActor: jest.fn().mockResolvedValue({ status: 'ok' }),
    unmuteActor: jest.fn().mockResolvedValue({ status: 'ok' }),
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
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: notificationsServiceMock }],
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

  it('GET /notifications returns paginated notifications', async () => {
    await request(app.getHttpServer()).get('/notifications?limit=10').expect(200);

    expect(notificationsServiceMock.listForUser).toHaveBeenCalledWith('u1', {
      limit: '10',
    });
  });

  it('GET /notifications/unread-count returns unread count', async () => {
    const response = await request(app.getHttpServer()).get('/notifications/unread-count').expect(200);

    expect(response.body.unreadCount).toBe(2);
    expect(notificationsServiceMock.getUnreadCount).toHaveBeenCalledWith('u1');
  });

  it('POST /notifications/:id/read marks one notification as read', async () => {
    await request(app.getHttpServer()).post('/notifications/n1/read').expect(201);

    expect(notificationsServiceMock.markRead).toHaveBeenCalledWith('u1', 'n1');
  });

  it('POST /notifications/read-all marks all notifications read', async () => {
    await request(app.getHttpServer()).post('/notifications/read-all').expect(201);

    expect(notificationsServiceMock.markAllRead).toHaveBeenCalledWith('u1');
  });

  it('GET /notifications/preferences returns current preferences', async () => {
    const response = await request(app.getHttpServer()).get('/notifications/preferences').expect(200);

    expect(response.body.likeEnabled).toBe(true);
    expect(notificationsServiceMock.getPreferences).toHaveBeenCalledWith('u1');
  });

  it('PUT /notifications/preferences updates preferences', async () => {
    const payload = {
      likeEnabled: false,
    };

    const response = await request(app.getHttpServer())
      .put('/notifications/preferences')
      .send(payload)
      .expect(200);

    expect(response.body.likeEnabled).toBe(false);
    expect(notificationsServiceMock.updatePreferences).toHaveBeenCalledWith('u1', payload);
  });

  it('GET /notifications/muted-users lists muted actors', async () => {
    const response = await request(app.getHttpServer()).get('/notifications/muted-users').expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(notificationsServiceMock.listMutedActors).toHaveBeenCalledWith('u1');
  });

  it('POST /notifications/muted-users/:id mutes actor', async () => {
    const mutedUserId = '9f2f3161-26bc-4f6a-a57d-a4eb9f9ad99f';
    await request(app.getHttpServer()).post(`/notifications/muted-users/${mutedUserId}`).expect(201);

    expect(notificationsServiceMock.muteActor).toHaveBeenCalledWith('u1', mutedUserId);
  });

  it('DELETE /notifications/muted-users/:id unmutes actor', async () => {
    const mutedUserId = '9f2f3161-26bc-4f6a-a57d-a4eb9f9ad99f';
    await request(app.getHttpServer()).delete(`/notifications/muted-users/${mutedUserId}`).expect(200);

    expect(notificationsServiceMock.unmuteActor).toHaveBeenCalledWith('u1', mutedUserId);
  });
});
