import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthController Integration', () => {
  let app: INestApplication;

  const authServiceMock = {
    signUp: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }),
    login: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }),
    refreshToken: jest.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/signup delegates to service and returns token pair', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'new@example.com',
        password: 'password123',
        displayName: 'New User',
      })
      .expect(201);

    expect(response.body).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(authServiceMock.signUp).toHaveBeenCalledTimes(1);
  });

  it('POST /auth/refresh delegates to service', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(201);

    expect(response.body.accessToken).toBe('new-access-token');
    expect(authServiceMock.refreshToken).toHaveBeenCalledWith('refresh-token');
  });
});
