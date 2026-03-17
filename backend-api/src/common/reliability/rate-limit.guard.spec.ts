import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_METADATA_KEY } from './rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  const requestWindow = new Map<string, number>();

  const redisClientMock = {
    incr: jest.fn(async (key: string) => {
      const current = (requestWindow.get(key) ?? 0) + 1;
      requestWindow.set(key, current);
      return current;
    }),
    expire: jest.fn(async () => 1),
  };

  const redisServiceMock = {
    getClient: () => redisClientMock,
  } as unknown as RedisService;

  const configServiceMock = {
    get: (key: string) => {
      if (key === 'RATE_LIMIT_MAX_REQUESTS') {
        return 2;
      }
      if (key === 'RATE_LIMIT_WINDOW_SECONDS') {
        return 60;
      }
      return undefined;
    },
  };

  const reflectorMock = {
    get: jest.fn((metadataKey: string) => {
      if (metadataKey === RATE_LIMIT_METADATA_KEY) {
        return undefined;
      }
      return undefined;
    }),
  } as unknown as Reflector;

  const createContext = () =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          path: '/auth/login',
          route: { path: '/auth/login' },
          headers: {
            'x-forwarded-for': '203.0.113.10',
          },
          socket: { remoteAddress: '203.0.113.10' },
          ip: '203.0.113.10',
        }),
      }),
      getHandler: () => ({}),
    }) as any;

  beforeEach(() => {
    requestWindow.clear();
    redisClientMock.incr.mockClear();
    redisClientMock.expire.mockClear();
    reflectorMock.get = jest.fn((metadataKey: string) => {
      if (metadataKey === RATE_LIMIT_METADATA_KEY) {
        return undefined;
      }
      return undefined;
    });
  });

  it('allows requests within configured limit', async () => {
    const guard = new RateLimitGuard(redisServiceMock, configServiceMock as any, reflectorMock);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  it('blocks requests after limit is exceeded', async () => {
    const guard = new RateLimitGuard(redisServiceMock, configServiceMock as any, reflectorMock);

    await guard.canActivate(createContext());
    await guard.canActivate(createContext());

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(HttpException);
  });

  it('uses route-level metadata override when provided', async () => {
    const guard = new RateLimitGuard(redisServiceMock, configServiceMock as any, reflectorMock);
    reflectorMock.get = jest.fn((metadataKey: string) => {
      if (metadataKey === RATE_LIMIT_METADATA_KEY) {
        return { limit: 1, windowSeconds: 30 };
      }
      return undefined;
    });

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(HttpException);
  });
});
