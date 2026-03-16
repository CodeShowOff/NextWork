import { Controller, Get, Header, Query } from '@nestjs/common';

import { RequestMetricsService } from './common/observability/request-metrics.service';
import { RealtimeMetricsService } from './common/observability/realtime-metrics.service';

@Controller('ops')
export class OpsController {
  constructor(
    private readonly requestMetricsService: RequestMetricsService,
    private readonly realtimeMetricsService: RealtimeMetricsService,
  ) {}

  @Get('metrics')
  metrics() {
    const snapshot = this.requestMetricsService.getSnapshot();
    return {
      ...snapshot,
      realtime: this.realtimeMetricsService.getSnapshot(),
    };
  }

  @Get('performance-check')
  performanceCheck(
    @Query('feedP95Ms') feedP95MsRaw?: string,
    @Query('searchP95Ms') searchP95MsRaw?: string,
  ) {
    const snapshot = this.requestMetricsService.getSnapshot();
    const parsedFeedBudget = Number(feedP95MsRaw ?? 300);
    const parsedSearchBudget = Number(searchP95MsRaw ?? 350);
    const feedP95BudgetMs = Number.isFinite(parsedFeedBudget) ? parsedFeedBudget : 300;
    const searchP95BudgetMs = Number.isFinite(parsedSearchBudget) ? parsedSearchBudget : 350;

    const feedRoutes = snapshot.requests.routes.filter((route) => route.path.includes('/feed'));
    const searchRoutes = snapshot.requests.routes.filter((route) => route.path.includes('/search'));

    const feedP95ObservedMs = feedRoutes.length
      ? Math.max(...feedRoutes.map((route) => route.p95DurationMs))
      : 0;
    const searchP95ObservedMs = searchRoutes.length
      ? Math.max(...searchRoutes.map((route) => route.p95DurationMs))
      : 0;

    return {
      status:
        feedP95ObservedMs <= feedP95BudgetMs && searchP95ObservedMs <= searchP95BudgetMs
          ? 'pass'
          : 'warn',
      budgetsMs: {
        feedP95: feedP95BudgetMs,
        searchP95: searchP95BudgetMs,
      },
      observedMs: {
        feedP95: feedP95ObservedMs,
        searchP95: searchP95ObservedMs,
      },
      routeCoverage: {
        feed: feedRoutes.map((route) => route.key),
        search: searchRoutes.map((route) => route.key),
      },
      realtime: this.realtimeMetricsService.getSnapshot(),
      sampledAt: snapshot.timestamp,
    };
  }

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  prometheus(): string {
    const snapshot = this.requestMetricsService.getSnapshot();
    const realtime = this.realtimeMetricsService.getSnapshot();
    const lines: string[] = [];

    lines.push('# HELP workplace_http_requests_total Total HTTP requests by route.');
    lines.push('# TYPE workplace_http_requests_total counter');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `workplace_http_requests_total{method="${route.method}",route="${route.path}"} ${route.requestCount}`,
      );
    }

    lines.push('# HELP workplace_http_errors_total Total HTTP error responses by route.');
    lines.push('# TYPE workplace_http_errors_total counter');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `workplace_http_errors_total{method="${route.method}",route="${route.path}"} ${route.errorCount}`,
      );
    }

    lines.push('# HELP workplace_http_request_avg_duration_ms Average HTTP duration in ms by route.');
    lines.push('# TYPE workplace_http_request_avg_duration_ms gauge');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `workplace_http_request_avg_duration_ms{method="${route.method}",route="${route.path}"} ${route.avgDurationMs}`,
      );
    }

    lines.push('# HELP workplace_http_request_p95_duration_ms p95 HTTP duration in ms by route.');
    lines.push('# TYPE workplace_http_request_p95_duration_ms gauge');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `workplace_http_request_p95_duration_ms{method="${route.method}",route="${route.path}"} ${route.p95DurationMs}`,
      );
    }

    lines.push('# HELP workplace_http_request_max_duration_ms Max HTTP duration in ms by route.');
    lines.push('# TYPE workplace_http_request_max_duration_ms gauge');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `workplace_http_request_max_duration_ms{method="${route.method}",route="${route.path}"} ${route.maxDurationMs}`,
      );
    }

    lines.push('# HELP workplace_process_heap_used_bytes Node.js heap used in bytes.');
    lines.push('# TYPE workplace_process_heap_used_bytes gauge');
    lines.push(`workplace_process_heap_used_bytes ${snapshot.process.heapUsedBytes}`);

    lines.push('# HELP workplace_websocket_active_connections Active websocket connections.');
    lines.push('# TYPE workplace_websocket_active_connections gauge');
    lines.push(`workplace_websocket_active_connections ${realtime.activeConnections}`);

    lines.push('# HELP workplace_websocket_authenticated_connections Authenticated websocket connections.');
    lines.push('# TYPE workplace_websocket_authenticated_connections gauge');
    lines.push(`workplace_websocket_authenticated_connections ${realtime.authenticatedConnections}`);

    lines.push('# HELP workplace_websocket_failed_auth_total Failed websocket authentications.');
    lines.push('# TYPE workplace_websocket_failed_auth_total counter');
    lines.push(`workplace_websocket_failed_auth_total ${realtime.failedAuthentications}`);

    return `${lines.join('\n')}\n`;
  }
}
