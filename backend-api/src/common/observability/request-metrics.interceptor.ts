import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { RequestMetricsService } from './request-metrics.service';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestMetricsInterceptor.name);

  constructor(
    private readonly requestMetricsService: RequestMetricsService,
    private readonly configService: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest<{
      method: string;
      route?: { path?: string };
      path?: string;
      url: string;
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode: number }>();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - startedAt;
        const routePath = request.route?.path || request.path || request.url;
        const statusCode = response.statusCode || 200;

        this.requestMetricsService.recordRequest({
          method: request.method,
          path: routePath,
          statusCode,
          durationMs,
        });

        const slowRequestThresholdMs = Number(
          this.configService.get('LOG_SLOW_REQUEST_MS') ?? 1200,
        );
        if (durationMs >= slowRequestThresholdMs) {
          this.logger.warn(
            `Slow request ${request.method} ${routePath} -> ${statusCode} in ${durationMs}ms`,
          );
        }
      }),
    );
  }
}
