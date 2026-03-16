import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly redisService: RedisService) {}

  async execute<T>(params: {
    scope: string;
    userId: string;
    idempotencyKey: string;
    ttlSeconds?: number;
    run: () => Promise<T>;
  }): Promise<T> {
    const ttlSeconds = params.ttlSeconds ?? 3600;
    const safeKey = this.hashKey(params.idempotencyKey);
    const lockKey = `idempotency:lock:${params.scope}:${params.userId}:${safeKey}`;
    const responseKey = `idempotency:result:${params.scope}:${params.userId}:${safeKey}`;

    const existing = await this.redisService.getClient().get(responseKey);
    if (existing) {
      return JSON.parse(existing) as T;
    }

    const lockAcquired = await this.redisService.getClient().set(lockKey, '1', 'EX', ttlSeconds, 'NX');
    if (!lockAcquired) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const retry = await this.redisService.getClient().get(responseKey);
        if (retry) {
          return JSON.parse(retry) as T;
        }
      }

      throw new ConflictException('A request with this idempotency key is already in progress.');
    }

    try {
      const result = await params.run();
      await this.redisService.getClient().set(responseKey, JSON.stringify(result), 'EX', ttlSeconds);
      return result;
    } finally {
      await this.redisService.getClient().del(lockKey);
    }
  }

  private hashKey(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
