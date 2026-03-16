import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_METADATA_KEY, RateLimitOptions } from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request) {
      return true;
    }

    const handlerOptions = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_METADATA_KEY,
      context.getHandler(),
    );

    const defaultLimit = Number(this.configService.get('RATE_LIMIT_MAX_REQUESTS') ?? 120);
    const defaultWindow = Number(this.configService.get('RATE_LIMIT_WINDOW_SECONDS') ?? 60);

    const options = handlerOptions ?? {
      limit: defaultLimit,
      windowSeconds: defaultWindow,
    };

    const ip = this.getIp(request);
    const routeKey = `${request.method}:${request.route?.path ?? request.path}`;
    const key = `rate-limit:${ip}:${routeKey}`;

    const current = await this.redisService.getClient().incr(key);
    if (current === 1) {
      await this.redisService.getClient().expire(key, options.windowSeconds);
    }

    if (current > options.limit) {
      throw new HttpException('Rate limit exceeded. Please retry shortly.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private getIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
