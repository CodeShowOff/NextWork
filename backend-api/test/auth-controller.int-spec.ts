import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';

describe('AuthController Integration', () => {
  let app: INestApplication;

  const authServiceMock = {
    signUp: jest.fn().mockResolvedValue({
      status: 'verification_required',
      email: 'new@example.com',
      expiresAt: '2026-03-17T01:00:00.000Z',
      debugCode: '123456',
    }),
    verifyEmail: jest.fn().mockResolvedValue({ status: 'ok' }),
    resendEmailVerification: jest
      .fn()
      .mockResolvedValue({ status: 'ok', expiresAt: '2026-03-17T01:00:00.000Z', debugCode: '123456' }),
    requestPasswordReset: jest
      .fn()
      .mockResolvedValue({ status: 'ok', expiresAt: '2026-03-17T01:00:00.000Z', debugCode: '789012' }),
    confirmPasswordReset: jest.fn().mockResolvedValue({ status: 'ok' }),
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

    expect(response.body.status).toBe('verification_required');
    expect(response.body.email).toBe('new@example.com');
    expect(authServiceMock.signUp).toHaveBeenCalledTimes(1);
    expect(authServiceMock.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        displayName: 'New User',
      }),
    );
  });

  it('POST /auth/signup accepts enriched onboarding fields', async () => {
    const payload = {
      email: 'onboard@example.com',
      password: 'password123',
      fullName: 'Onboard User',
      displayName: 'Onboard User',
      organizationName: 'Acme Org',
      organizationSize: '11-50',
      jobTitle: 'Engineer',
    };

    await request(app.getHttpServer()).post('/auth/signup').send(payload).expect(201);

    expect(authServiceMock.signUp).toHaveBeenCalledWith(expect.objectContaining(payload));
  });

  it('POST /auth/refresh delegates to service', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'refresh-token' })
      .expect(201);

    expect(response.body.accessToken).toBe('new-access-token');
    expect(authServiceMock.refreshToken).toHaveBeenCalledWith('refresh-token');
  });

  it('POST /auth/verify-email delegates to service', async () => {
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({
        email: 'new@example.com',
        verificationCode: '123456',
      })
      .expect(201);

    expect(authServiceMock.verifyEmail).toHaveBeenCalledWith({
      email: 'new@example.com',
      verificationCode: '123456',
    });
  });

  it('POST /auth/resend-verification requests a new code', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/resend-verification')
      .send({ email: 'new@example.com' })
      .expect(201);

    expect(response.body.status).toBe('ok');
    expect(authServiceMock.resendEmailVerification).toHaveBeenCalledWith('new@example.com');
  });

  it('POST /auth/forgot-password delegates to service', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'new@example.com' })
      .expect(201);

    expect(response.body.status).toBe('ok');
    expect(authServiceMock.requestPasswordReset).toHaveBeenCalledWith('new@example.com');
  });

  it('POST /auth/reset-password delegates to service', async () => {
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        email: 'new@example.com',
        resetCode: '789012',
        newPassword: 'new-password-123',
      })
      .expect(201);

    expect(authServiceMock.confirmPasswordReset).toHaveBeenCalledWith({
      email: 'new@example.com',
      resetCode: '789012',
      newPassword: 'new-password-123',
    });
  });
});
