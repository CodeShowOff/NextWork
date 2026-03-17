import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  const usersServiceMock = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    findById: jest.fn(),
  } as unknown as UsersService;

  const jwtServiceMock = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

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
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(
      usersServiceMock,
      jwtServiceMock,
      configServiceMock as never,
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
    (jwtServiceMock.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    (usersServiceMock.updateRefreshTokenHash as jest.Mock).mockResolvedValue({});

    const result = await authService.signUp({
      email: 'new@example.com',
      password: 'password123',
      displayName: 'Legacy Name',
      fullName: 'Aligned Full Name',
      organizationName: 'Acme Org',
      organizationSize: '11-50',
      jobTitle: 'Engineer',
    });

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(usersServiceMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Aligned Full Name',
        organizationName: 'Acme Org',
        organizationSize: '11-50',
        jobTitle: 'Engineer',
      }),
    );
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
    });

    await expect(authService.refreshToken('refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
