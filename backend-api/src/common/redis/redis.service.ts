import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;
  private readonly exportOnlyMode: boolean;

  constructor(private readonly configService: ConfigService) {
    this.exportOnlyMode = process.env.OPENAPI_EXPORT_ONLY === 'true';
    const redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: this.exportOnlyMode,
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  getClient(): Redis {
    return this.redis;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.exportOnlyMode) {
      this.redis.disconnect();
      return;
    }

    await this.redis.quit();
  }
}
