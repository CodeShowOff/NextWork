import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { CacheService } from '../cache/cache.service';
import { RedisService } from '../redis/redis.service';

interface CacheInvalidationJob {
  type: 'invalidate-cache-prefix';
  prefix: string;
}

@Injectable()
export class BackgroundJobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundJobsService.name);
  private readonly queueName = 'jobs:cache-invalidation';
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly redisService: RedisService,
    private readonly cacheService: CacheService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.drainQueue().catch((error) => {
        this.logger.error(`Background queue drain failed: ${(error as Error).message}`);
      });
    }, 5000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async enqueueCachePrefixInvalidation(prefix: string): Promise<void> {
    const payload: CacheInvalidationJob = {
      type: 'invalidate-cache-prefix',
      prefix,
    };

    await this.redisService.getClient().rpush(this.queueName, JSON.stringify(payload));
  }

  private async drainQueue(): Promise<void> {
    for (let i = 0; i < 50; i += 1) {
      const raw = await this.redisService.getClient().lpop(this.queueName);
      if (!raw) {
        break;
      }

      let job: CacheInvalidationJob;
      try {
        job = JSON.parse(raw) as CacheInvalidationJob;
      } catch (error) {
        this.logger.warn(`Skipping malformed background job payload: ${(error as Error).message}`);
        continue;
      }

      if (job.type === 'invalidate-cache-prefix') {
        await this.cacheService.deleteByPrefix(job.prefix);
      }
    }
  }
}
