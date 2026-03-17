import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

import { EmailService } from '../../common/email/email.service';
import { InvitesService } from '../invites/invites.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  const usersServiceMock = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    findById: jest.fn(),
    setEmailVerificationToken: jest.fn(),
    clearEmailVerificationToken: jest.fn(),
    markEmailVerified: jest.fn(),
    setPasswordResetToken: jest.fn(),
    clearPasswordResetToken: jest.fn(),
    updatePasswordHash: jest.fn(),
  } as unknown as UsersService;

  const jwtServiceMock = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const emailServiceMock = {
    sendTransactionalEmail: jest.fn().mockResolvedValue(undefined),
  } as unknown as EmailService;

  const invitesServiceMock = {
    getInviteByToken: jest.fn(),
    acceptInvite: jest.fn(),
  } as unknown as InvitesService;

  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        JWT_ACCESS_SECRET: 'a'.repeat(32),
        JWT_REFRESH_SECRET: 'b'.repeat(32),
        JWT_ACCESS_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return map[key];
    }),
    get: jest.fn(() => undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(
      usersServiceMock,
      jwtServiceMock,
      configServiceMock as never,
      emailServiceMock,
      invitesServiceMock,
    );
  });

  it('throws ConflictException for existing email during signup', async () => {
    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({ id: 'u1' });

    await expect(
      authService.signUp({
        email: 'exists@example.com',
        password: 'password123',
        displayName: 'Existing User',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns token pair on valid login', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);

    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash,
      status: 'active',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    (jwtServiceMock.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    (usersServiceMock.updateRefreshTokenHash as jest.Mock).mockResolvedValue({});

    const result = await authService.login({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(usersServiceMock.updateRefreshTokenHash).toHaveBeenCalledTimes(1);
  });

  it('uses fullName for displayName alignment during signup', async () => {
    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);
    (usersServiceMock.createUser as jest.Mock).mockResolvedValue({
      id: 'u-signup',
      email: 'new@example.com',
    });
    const result = await authService.signUp({
      email: 'new@example.com',
      password: 'password123',
      displayName: 'Legacy Name',
      fullName: 'Aligned Full Name',
      organizationName: 'Acme Org',
      organizationSize: '11-50',
      jobTitle: 'Engineer',
    });

    expect(result.status).toBe('verification_required');
    expect(result.email).toBe('new@example.com');
    expect(result.expiresAt).toBeDefined();
    expect(usersServiceMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Aligned Full Name',
        organizationName: 'Acme Org',
        organizationSize: '11-50',
        jobTitle: 'Engineer',
      }),
    );
    expect(usersServiceMock.setEmailVerificationToken).toHaveBeenCalledTimes(1);
    expect((emailServiceMock.sendTransactionalEmail as jest.Mock).mock.calls.length).toBe(1);
  });

  it('throws BadRequestException when both fullName and displayName are missing', async () => {
    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

    await expect(
      authService.signUp({
        email: 'no-name@example.com',
        password: 'password123',
        displayName: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws UnauthorizedException on invalid login password', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);

    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash,
      status: 'active',
      emailVerifiedAt: null,
    });

    await expect(
      authService.login({
        email: 'user@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException on inactive user login', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);

    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash,
      status: 'disabled',
    });

    await expect(
      authService.login({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException on inactive user refresh', async () => {
    (jwtServiceMock.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      email: 'user@example.com',
      type: 'refresh',
    });
    (usersServiceMock.findById as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      status: 'disabled',
      refreshTokenHash: await bcrypt.hash('refresh-token', 10),
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(authService.refreshToken('refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects login for unverified users', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash,
      status: 'active',
      emailVerifiedAt: null,
    });

    await expect(
      authService.login({
        email: 'user@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifies email with valid token', async () => {
    const token = '123456';
    const tokenHash = createHash('sha256').update(token).digest('hex');

    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      emailVerifiedAt: null,
      emailVerificationTokenHash: tokenHash,
      emailVerificationTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      authService.verifyEmail({
        email: 'user@example.com',
        token,
      }),
    ).resolves.toEqual({ status: 'ok' });

    expect(usersServiceMock.markEmailVerified).toHaveBeenCalledWith('u1');
  });

  it('fails email verification when token is expired', async () => {
    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      emailVerifiedAt: null,
      emailVerificationTokenHash: 'hash',
      emailVerificationTokenExpiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      authService.verifyEmail({
        email: 'user@example.com',
        token: '123456',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requests password reset for verified user', async () => {
    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await authService.requestPasswordReset('user@example.com');
    expect(result.status).toBe('ok');
    expect(result.expiresAt).toBeTruthy();
    expect(usersServiceMock.setPasswordResetToken).toHaveBeenCalledTimes(1);
    expect((emailServiceMock.sendTransactionalEmail as jest.Mock).mock.calls.length).toBe(1);
  });

  it('confirms password reset with valid token', async () => {
    const token = '123456';
    const tokenHash = createHash('sha256').update(token).digest('hex');

    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordResetTokenHash: tokenHash,
      passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      authService.confirmPasswordReset({
        email: 'user@example.com',
        token,
        newPassword: 'new-password-123',
      }),
    ).resolves.toEqual({ status: 'ok' });

    expect(usersServiceMock.updatePasswordHash).toHaveBeenCalledWith(
      'u1',
      expect.any(String),
    );
  });

  it('throws when reset target account does not exist', async () => {
    (usersServiceMock.findByEmail as jest.Mock).mockResolvedValue(null);

    await expect(
      authService.confirmPasswordReset({
        email: 'missing@example.com',
        token: '123456',
        newPassword: 'new-password-123',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
