import { Controller, Get, Header, Query } from '@nestjs/common';

import { BackgroundJobsService } from './common/reliability/background-jobs.service';
import { RequestMetricsService } from './common/observability/request-metrics.service';
import { RealtimeMetricsService } from './common/observability/realtime-metrics.service';

@Controller('ops')
export class OpsController {
  constructor(
    private readonly requestMetricsService: RequestMetricsService,
    private readonly realtimeMetricsService: RealtimeMetricsService,
    private readonly backgroundJobsService: BackgroundJobsService,
  ) {}

  @Get('metrics')
  async metrics() {
    const snapshot = this.requestMetricsService.getSnapshot();
    const backgroundJobs = await this.backgroundJobsService.getSnapshot();
    return {
      ...snapshot,
      realtime: this.realtimeMetricsService.getSnapshot(),
      backgroundJobs,
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
  async prometheus(): Promise<string> {
    const snapshot = this.requestMetricsService.getSnapshot();
    const realtime = this.realtimeMetricsService.getSnapshot();
    const backgroundJobs = await this.backgroundJobsService.getSnapshot();
    const lines: string[] = [];

    lines.push('# HELP nextwork_http_requests_total Total HTTP requests by route.');
    lines.push('# TYPE nextwork_http_requests_total counter');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `nextwork_http_requests_total{method="${route.method}",route="${route.path}"} ${route.requestCount}`,
      );
    }

    lines.push('# HELP nextwork_http_errors_total Total HTTP error responses by route.');
    lines.push('# TYPE nextwork_http_errors_total counter');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `nextwork_http_errors_total{method="${route.method}",route="${route.path}"} ${route.errorCount}`,
      );
    }

    lines.push('# HELP nextwork_http_request_avg_duration_ms Average HTTP duration in ms by route.');
    lines.push('# TYPE nextwork_http_request_avg_duration_ms gauge');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `nextwork_http_request_avg_duration_ms{method="${route.method}",route="${route.path}"} ${route.avgDurationMs}`,
      );
    }

    lines.push('# HELP nextwork_http_request_p95_duration_ms p95 HTTP duration in ms by route.');
    lines.push('# TYPE nextwork_http_request_p95_duration_ms gauge');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `nextwork_http_request_p95_duration_ms{method="${route.method}",route="${route.path}"} ${route.p95DurationMs}`,
      );
    }

    lines.push('# HELP nextwork_http_request_max_duration_ms Max HTTP duration in ms by route.');
    lines.push('# TYPE nextwork_http_request_max_duration_ms gauge');
    for (const route of snapshot.requests.routes) {
      lines.push(
        `nextwork_http_request_max_duration_ms{method="${route.method}",route="${route.path}"} ${route.maxDurationMs}`,
      );
    }

    lines.push('# HELP nextwork_process_heap_used_bytes Node.js heap used in bytes.');
    lines.push('# TYPE nextwork_process_heap_used_bytes gauge');
    lines.push(`nextwork_process_heap_used_bytes ${snapshot.process.heapUsedBytes}`);

    lines.push('# HELP nextwork_websocket_active_connections Active websocket connections.');
    lines.push('# TYPE nextwork_websocket_active_connections gauge');
    lines.push(`nextwork_websocket_active_connections ${realtime.activeConnections}`);

    lines.push('# HELP nextwork_websocket_authenticated_connections Authenticated websocket connections.');
    lines.push('# TYPE nextwork_websocket_authenticated_connections gauge');
    lines.push(`nextwork_websocket_authenticated_connections ${realtime.authenticatedConnections}`);

    lines.push('# HELP nextwork_websocket_failed_auth_total Failed websocket authentications.');
    lines.push('# TYPE nextwork_websocket_failed_auth_total counter');
    lines.push(`nextwork_websocket_failed_auth_total ${realtime.failedAuthentications}`);

    lines.push('# HELP nextwork_background_jobs_enqueued_total Enqueued background jobs.');
    lines.push('# TYPE nextwork_background_jobs_enqueued_total counter');
    lines.push(`nextwork_background_jobs_enqueued_total ${backgroundJobs.counters.enqueued}`);

    lines.push('# HELP nextwork_background_jobs_processed_total Successfully processed background jobs.');
    lines.push('# TYPE nextwork_background_jobs_processed_total counter');
    lines.push(`nextwork_background_jobs_processed_total ${backgroundJobs.counters.processed}`);

    lines.push('# HELP nextwork_background_jobs_failed_total Background job failures.');
    lines.push('# TYPE nextwork_background_jobs_failed_total counter');
    lines.push(`nextwork_background_jobs_failed_total ${backgroundJobs.counters.failed}`);

    lines.push('# HELP nextwork_background_jobs_retried_total Background jobs retried after transient failures.');
    lines.push('# TYPE nextwork_background_jobs_retried_total counter');
    lines.push(`nextwork_background_jobs_retried_total ${backgroundJobs.counters.retried}`);

    lines.push('# HELP nextwork_background_jobs_dead_lettered_total Background jobs moved to dead-letter queue.');
    lines.push('# TYPE nextwork_background_jobs_dead_lettered_total counter');
    lines.push(`nextwork_background_jobs_dead_lettered_total ${backgroundJobs.counters.deadLettered}`);

    lines.push('# HELP nextwork_background_queue_jobs Number of jobs by state in primary background queue.');
    lines.push('# TYPE nextwork_background_queue_jobs gauge');
    lines.push(`nextwork_background_queue_jobs{queue="main",state="waiting"} ${backgroundJobs.queue.waiting}`);
    lines.push(`nextwork_background_queue_jobs{queue="main",state="active"} ${backgroundJobs.queue.active}`);
    lines.push(`nextwork_background_queue_jobs{queue="main",state="delayed"} ${backgroundJobs.queue.delayed}`);
    lines.push(`nextwork_background_queue_jobs{queue="main",state="completed"} ${backgroundJobs.queue.completed}`);
    lines.push(`nextwork_background_queue_jobs{queue="main",state="failed"} ${backgroundJobs.queue.failed}`);
    lines.push(`nextwork_background_queue_jobs{queue="main",state="paused"} ${backgroundJobs.queue.paused}`);

    lines.push('# HELP nextwork_background_queue_jobs_dlq Number of jobs by state in dead-letter queue.');
    lines.push('# TYPE nextwork_background_queue_jobs_dlq gauge');
    lines.push(`nextwork_background_queue_jobs_dlq{queue="dlq",state="waiting"} ${backgroundJobs.deadLetterQueue.waiting}`);
    lines.push(`nextwork_background_queue_jobs_dlq{queue="dlq",state="active"} ${backgroundJobs.deadLetterQueue.active}`);
    lines.push(`nextwork_background_queue_jobs_dlq{queue="dlq",state="delayed"} ${backgroundJobs.deadLetterQueue.delayed}`);
    lines.push(`nextwork_background_queue_jobs_dlq{queue="dlq",state="completed"} ${backgroundJobs.deadLetterQueue.completed}`);
    lines.push(`nextwork_background_queue_jobs_dlq{queue="dlq",state="failed"} ${backgroundJobs.deadLetterQueue.failed}`);
    lines.push(`nextwork_background_queue_jobs_dlq{queue="dlq",state="paused"} ${backgroundJobs.deadLetterQueue.paused}`);

    return `${lines.join('\n')}\n`;
  }
}
