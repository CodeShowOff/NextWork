import { Controller, Get } from '@nestjs/common';

import { PrismaService } from './common/database/prisma.service';
import { RedisService } from './common/redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  async check() {
    return this.readiness();
  }

  @Get('live')
  liveness() {
    return {
      status: 'ok',
      checks: {
        app: 'alive',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async readiness() {
    const startedAt = Date.now();

    await this.prisma.$queryRaw`SELECT 1`;
    const redis = this.redisService.getClient();
    const redisStatus = await redis.ping();

    return {
      status: 'ok',
      checks: {
        postgres: 'ok',
        redis: redisStatus === 'PONG' ? 'ok' : 'degraded',
      },
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}
