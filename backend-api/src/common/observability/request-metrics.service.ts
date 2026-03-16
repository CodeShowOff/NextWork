import { Injectable } from '@nestjs/common';

export interface RouteMetrics {
  key: string;
  method: string;
  path: string;
  requestCount: number;
  errorCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  maxDurationMs: number;
  lastStatusCode: number;
  lastSeenAt: string;
}

interface MutableRouteMetrics {
  method: string;
  path: string;
  requestCount: number;
  errorCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  recentDurations: number[];
  lastStatusCode: number;
  lastSeenAt: Date;
}

@Injectable()
export class RequestMetricsService {
  private readonly startedAt = Date.now();
  private totalRequests = 0;
  private totalErrors = 0;
  private readonly routeStats = new Map<string, MutableRouteMetrics>();

  recordRequest(params: {
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
  }): void {
    const routeKey = `${params.method.toUpperCase()} ${params.path}`;
    const existing = this.routeStats.get(routeKey) ?? {
      method: params.method.toUpperCase(),
      path: params.path,
      requestCount: 0,
      errorCount: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
      recentDurations: [],
      lastStatusCode: 0,
      lastSeenAt: new Date(),
    };

    existing.requestCount += 1;
    existing.totalDurationMs += params.durationMs;
    existing.maxDurationMs = Math.max(existing.maxDurationMs, params.durationMs);
    existing.lastStatusCode = params.statusCode;
    existing.lastSeenAt = new Date();

    existing.recentDurations.push(params.durationMs);
    if (existing.recentDurations.length > 500) {
      existing.recentDurations.shift();
    }

    if (params.statusCode >= 400) {
      existing.errorCount += 1;
      this.totalErrors += 1;
    }

    this.totalRequests += 1;
    this.routeStats.set(routeKey, existing);
  }

  getSnapshot(): {
    status: 'ok';
    uptimeSeconds: number;
    process: {
      rssBytes: number;
      heapUsedBytes: number;
      heapTotalBytes: number;
      externalBytes: number;
      nodeVersion: string;
      pid: number;
    };
    requests: {
      total: number;
      totalErrors: number;
      errorRate: number;
      routes: RouteMetrics[];
    };
    timestamp: string;
  } {
    const memory = process.memoryUsage();
    const routes = [...this.routeStats.entries()].map(([key, value]) => {
      const sorted = [...value.recentDurations].sort((a, b) => a - b);
      const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
      const p95 = sorted.length > 0 ? sorted[p95Index] : 0;

      return {
        key,
        method: value.method,
        path: value.path,
        requestCount: value.requestCount,
        errorCount: value.errorCount,
        avgDurationMs: value.requestCount > 0 ? value.totalDurationMs / value.requestCount : 0,
        p95DurationMs: p95,
        maxDurationMs: value.maxDurationMs,
        lastStatusCode: value.lastStatusCode,
        lastSeenAt: value.lastSeenAt.toISOString(),
      };
    });

    routes.sort((a, b) => b.requestCount - a.requestCount);

    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      process: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external,
        nodeVersion: process.version,
        pid: process.pid,
      },
      requests: {
        total: this.totalRequests,
        totalErrors: this.totalErrors,
        errorRate: this.totalRequests > 0 ? this.totalErrors / this.totalRequests : 0,
        routes,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
