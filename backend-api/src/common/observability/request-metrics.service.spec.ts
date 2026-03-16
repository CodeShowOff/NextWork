import { RequestMetricsService } from './request-metrics.service';

describe('RequestMetricsService', () => {
  it('aggregates per-route request stats and error rate', () => {
    const service = new RequestMetricsService();

    service.recordRequest({
      method: 'GET',
      path: '/feed',
      statusCode: 200,
      durationMs: 120,
    });
    service.recordRequest({
      method: 'GET',
      path: '/feed',
      statusCode: 500,
      durationMs: 200,
    });

    const snapshot = service.getSnapshot();

    expect(snapshot.requests.total).toBe(2);
    expect(snapshot.requests.totalErrors).toBe(1);
    expect(snapshot.requests.errorRate).toBe(0.5);

    const route = snapshot.requests.routes.find((item) => item.key === 'GET /feed');
    expect(route).toBeDefined();
    expect(route?.requestCount).toBe(2);
    expect(route?.errorCount).toBe(1);
    expect(route?.maxDurationMs).toBe(200);
  });
});
