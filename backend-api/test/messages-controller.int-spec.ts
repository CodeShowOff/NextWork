import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { IdempotencyService } from '../src/common/reliability/idempotency.service';
import { MessagesController } from '../src/modules/messages/messages.controller';
import { MessagesService } from '../src/modules/messages/messages.service';

describe('MessagesController Integration', () => {
  let app: INestApplication;

  const messagesServiceMock = {
    createConversation: jest.fn().mockResolvedValue({
      id: 'c1',
      type: 'direct',
      createdAt: '2026-03-16T00:00:00.000Z',
      participants: [
        {
          userId: 'u1',
          displayName: 'User One',
          avatarUrl: null,
          role: 'member',
        },
        {
          userId: 'u2',
          displayName: 'User Two',
          avatarUrl: null,
          role: 'member',
        },
      ],
      lastMessage: null,
      unreadCount: 0,
    }),
    listConversations: jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    }),
    getUnreadCount: jest.fn().mockResolvedValue({ unreadCount: 3 }),
    listMessages: jest.fn().mockResolvedValue({
      items: [],
      nextCursor: null,
    }),
    sendMessage: jest.fn().mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      body: 'Hello',
      messageType: 'text',
      createdAt: '2026-03-16T00:00:00.000Z',
      editedAt: null,
      sender: {
        id: 'u1',
        displayName: 'User One',
        avatarUrl: null,
      },
    }),
    markConversationRead: jest.fn().mockResolvedValue(undefined),
    updateMessage: jest.fn().mockResolvedValue({
      id: 'm1',
      conversationId: 'c1',
      senderId: 'u1',
      body: 'Edited hello',
      messageType: 'text',
      createdAt: '2026-03-16T00:00:00.000Z',
      editedAt: '2026-03-16T00:01:00.000Z',
      sender: {
        id: 'u1',
        displayName: 'User One',
        avatarUrl: null,
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

  const idempotencyServiceMock = {
    execute: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: MessagesService, useValue: messagesServiceMock },
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

  it('POST /messages/conversations creates conversation for current user', async () => {
    const payload = {
      type: 'direct',
      participantIds: ['u2'],
    };

    const response = await request(app.getHttpServer())
      .post('/messages/conversations')
      .send(payload)
      .expect(201);

    expect(response.body.id).toBe('c1');
    expect(messagesServiceMock.createConversation).toHaveBeenCalledWith('u1', payload);
  });

  it('GET /messages/conversations delegates query options', async () => {
    await request(app.getHttpServer()).get('/messages/conversations?limit=10').expect(200);

    expect(messagesServiceMock.listConversations).toHaveBeenCalledWith('u1', {
      limit: '10',
    });
  });

  it('GET /messages/unread-count returns aggregate count', async () => {
    const response = await request(app.getHttpServer()).get('/messages/unread-count').expect(200);

    expect(response.body.unreadCount).toBe(3);
    expect(messagesServiceMock.getUnreadCount).toHaveBeenCalledWith('u1');
  });

  it('GET /messages/conversations/:id/messages delegates request', async () => {
    await request(app.getHttpServer())
      .get('/messages/conversations/c1/messages?before=2026-03-16T01:00:00.000Z')
      .expect(200);

    expect(messagesServiceMock.listMessages).toHaveBeenCalledWith('u1', 'c1', {
      before: '2026-03-16T01:00:00.000Z',
    });
  });

  it('POST /messages/conversations/:id/messages sends message', async () => {
    const payload = {
      body: 'Hello',
      messageType: 'text',
    };

    await request(app.getHttpServer())
      .post('/messages/conversations/c1/messages')
      .send(payload)
      .expect(201);

    expect(messagesServiceMock.sendMessage).toHaveBeenCalledWith('u1', 'c1', payload);
  });

  it('POST /messages/conversations/:id/read marks conversation read', async () => {
    await request(app.getHttpServer())
      .post('/messages/conversations/c1/read')
      .send({ lastReadMessageId: '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928' })
      .expect(201);

    expect(messagesServiceMock.markConversationRead).toHaveBeenCalledWith(
      'u1',
      'c1',
      '89ce5ff7-bc2a-4df8-b56b-b8e92f93e928',
    );
  });

  it('PATCH /messages/conversations/:id/messages/:messageId updates a message', async () => {
    const payload = {
      body: 'Edited hello',
    };

    const response = await request(app.getHttpServer())
      .patch('/messages/conversations/c1/messages/m1')
      .send(payload)
      .expect(200);

    expect(response.body.editedAt).toBe('2026-03-16T00:01:00.000Z');
    expect(messagesServiceMock.updateMessage).toHaveBeenCalledWith('u1', 'c1', 'm1', payload);
  });
});
