import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_METADATA_KEY = 'rate_limit_options';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, { limit, windowSeconds } satisfies RateLimitOptions);
