import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redisService: RedisService) {}

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.redisService.getClient().get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`Invalid cached JSON for key ${key}: ${(error as Error).message}`);
      await this.redisService.getClient().del(key);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.redisService.getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async deleteByKey(key: string): Promise<void> {
    await this.redisService.getClient().del(key);
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const client = this.redisService.getClient();
    let cursor = '0';

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  }
}
