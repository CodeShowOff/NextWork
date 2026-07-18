# Production Readiness Runbook

## Purpose

This runbook defines mandatory checks before promoting NextWork services to production.

## Scope

- backend-api
- mobile-app
- infrastructure service dependencies (PostgreSQL, Redis)
- release automation and monitoring stack (Prometheus, Grafana, Alertmanager)

## Pre-Release Checklist

1. Code quality
- CI is green on main and release branch.
- Lint/typecheck/test pass for all workspaces.
- All critical regressions resolved or accepted with explicit sign-off.

2. Backend runtime readiness
- /api/v1/health/live returns ok.
- /api/v1/health/ready returns ok.
- /api/v1/ops/metrics endpoint returns valid metrics payload.
- Rate limiting and idempotency controls verified in staging.

3. Data and dependencies
- PostgreSQL and Redis connectivity verified in staging and production.
- Prisma schema sync applied and schema compatibility confirmed.
- Seed usage disabled for production unless explicitly required.

4. Security and configuration
- JWT secrets rotated and stored in secure secret manager.
- CORS and allowed origins reviewed for production domains.
- Environment values validated with startup schema checks.
- Security preflight script executed: `npm run test:security`.

5. Mobile readiness
- Messaging and notifications paths smoke tested on target devices.
- Build configuration and API base URL correctness validated.
- Crash-free baseline validated in beta/internal channel.
- Maestro E2E smoke flows executed from `mobile-app/e2e/maestro`.

6. Performance validation
- Load budgets validated via `npm run test:load` using staging endpoint and release token.
- `GET /api/v1/ops/performance-check` reports `pass` for feed/search p95 budgets.

7. Observability readiness
- Grafana dashboard `nextwork-overview` imported and green.
- Alertmanager routes active for API/DB/Redis/socket alerts.
- On-call roster aware of rollback criteria and incident ownership.

## Staged Rollout Plan

1. Internal rollout
- Deploy backend to production with internal-only traffic.
- Validate readiness endpoints and metrics for 30 minutes.

2. Canary rollout
- Route 5%-10% of traffic to new revision.
- Monitor error rate, p95 latency, and Redis/PostgreSQL saturation.
- Hold for at least 60 minutes.

3. Progressive rollout
- Increase to 25%, then 50%, then 100% if SLOs remain healthy.
- Pause rollout immediately on sustained error-rate increase.

## Rollback Criteria

Rollback immediately if any of the following occur:

- sustained backend error rate above 2% for 10 minutes
- p95 API latency greater than 1.5s on core endpoints
- database or redis instability impacting user-facing requests

## Rollback Steps

1. Shift traffic to previous stable release.
2. Confirm readiness and metrics on rollback revision.
3. Disable new deployment artifacts from automation pipeline.
4. Open incident record with timeline and root cause analysis owner.

## Post-Release Validation

1. Confirm notifications, feed, and messaging live workflows.
2. Review ops metrics endpoint route/error distribution.
3. Confirm no abnormal slow request logs beyond expected threshold.
4. Complete release sign-off in engineering changelog.

## Incident Response Summary

1. Triage severity within 5 minutes and acknowledge alert.
2. Validate blast radius using dashboard and alert context.
3. If SLO breach is sustained, execute rollback steps immediately.
4. Open incident record with owner, mitigation steps, and follow-up actions.
