import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { RequestMetricsService } from '../src/common/observability/request-metrics.service';
import { RealtimeMetricsService } from '../src/common/observability/realtime-metrics.service';
import { BackgroundJobsService } from '../src/common/reliability/background-jobs.service';
import { OpsController } from '../src/ops.controller';

describe('OpsController Integration', () => {
  let app: INestApplication;

  const requestMetricsServiceMock = {
    getSnapshot: jest.fn().mockReturnValue({
      status: 'ok',
      uptimeSeconds: 10,
      process: {
        rssBytes: 123,
        heapUsedBytes: 456,
        heapTotalBytes: 789,
        externalBytes: 100,
        nodeVersion: process.version,
        pid: process.pid,
      },
      requests: {
        total: 5,
        totalErrors: 1,
        errorRate: 0.2,
        routes: [
          {
            key: 'GET /feed',
            method: 'GET',
            path: '/feed',
            requestCount: 3,
            errorCount: 0,
            avgDurationMs: 45,
            p95DurationMs: 120,
            maxDurationMs: 200,
            lastStatusCode: 200,
            lastSeenAt: '2026-03-16T00:00:00.000Z',
          },
          {
            key: 'GET /search',
            method: 'GET',
            path: '/search',
            requestCount: 2,
            errorCount: 0,
            avgDurationMs: 80,
            p95DurationMs: 210,
            maxDurationMs: 280,
            lastStatusCode: 200,
            lastSeenAt: '2026-03-16T00:00:00.000Z',
          },
        ],
      },
      timestamp: '2026-03-16T00:00:00.000Z',
    }),
  };

  const realtimeMetricsServiceMock = {
    getSnapshot: jest.fn().mockReturnValue({
      activeConnections: 3,
      authenticatedConnections: 3,
      failedAuthentications: 0,
      sentMessages: 12,
      typingEvents: 8,
      sampledAt: '2026-03-16T00:00:00.000Z',
    }),
  };

  const backgroundJobsServiceMock = {
    getSnapshot: jest.fn().mockResolvedValue({
      queueName: 'jobs:cache-invalidation',
      deadLetterQueueName: 'jobs:cache-invalidation:dlq',
      counters: {
        enqueued: 1,
        processed: 1,
        failed: 0,
        retried: 0,
        deadLettered: 0,
      },
      queue: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 1,
        failed: 0,
        paused: 0,
      },
      deadLetterQueue: {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
      },
      sampledAt: '2026-03-16T00:00:00.000Z',
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpsController],
      providers: [
        { provide: RequestMetricsService, useValue: requestMetricsServiceMock },
        { provide: RealtimeMetricsService, useValue: realtimeMetricsServiceMock },
        { provide: BackgroundJobsService, useValue: backgroundJobsServiceMock },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /ops/metrics returns runtime metrics snapshot', async () => {
    const response = await request(app.getHttpServer()).get('/ops/metrics').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.requests.total).toBe(5);
    expect(response.body.realtime.activeConnections).toBe(3);
    expect(response.body.backgroundJobs.counters.processed).toBe(1);
    expect(requestMetricsServiceMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(realtimeMetricsServiceMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(backgroundJobsServiceMock.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('GET /ops/performance-check returns pass when p95 values meet budget', async () => {
    const response = await request(app.getHttpServer())
      .get('/ops/performance-check?feedP95Ms=150&searchP95Ms=250')
      .expect(200);

    expect(response.body.status).toBe('pass');
    expect(response.body.observedMs.feedP95).toBe(120);
    expect(response.body.observedMs.searchP95).toBe(210);
    expect(response.body.routeCoverage.feed).toContain('GET /feed');
    expect(response.body.routeCoverage.search).toContain('GET /search');
    expect(response.body.realtime.activeConnections).toBe(3);
    expect(requestMetricsServiceMock.getSnapshot).toHaveBeenCalledTimes(1);
    expect(realtimeMetricsServiceMock.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('GET /ops/prometheus returns Prometheus text exposition', async () => {
    const response = await request(app.getHttpServer()).get('/ops/prometheus').expect(200);

    expect(response.text).toContain('workplace_http_requests_total');
    expect(response.text).toContain('workplace_http_request_p95_duration_ms');
    expect(response.text).toContain('workplace_websocket_active_connections');
  });
});
