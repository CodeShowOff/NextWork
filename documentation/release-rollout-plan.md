# Release Rollout Plan

## Strategy

Progressive rollout phases:
1. Internal channel
2. Beta channel
3. Production channel

## Phase Gates

### Internal
- CI quality gates green.
- Security preflight passes.
- Mobile smoke E2E flows pass.
- On-call notified and runbook linked.

### Beta
- Internal rollout stable for 24h.
- Error rate < 1% and p95 budgets respected.
- No Sev1/Sev2 incidents open.

### Production
- Beta rollout stable for 48h.
- SLOs pass in dashboard and ops performance check.
- Product + engineering signoff completed.

## Rollout Controls

- Start at 5% traffic.
- Increase to 25%, 50%, 100% only when metrics remain healthy.
- Auto-pause and rollback on sustained threshold breach.

## Phase 9 Rollout Schedule

1. Internal: 5% for 2 hours, then 25% for 22 hours.
2. Beta: 25% for 12 hours, then 50% for 36 hours.
3. Production: 50% for 12 hours, then 100% when all gates remain green.

## Monitoring Thresholds (Hold or Roll Back if Breached)

- API error rate > 1% for 10 consecutive minutes.
- p95 latency budget breach on feed/search/messages for 3 consecutive windows.
- Crash-free sessions < 99.5% for 30 minutes.
- Notification delivery lag > 60 seconds sustained for 10 minutes.

## Rollback Triggers

- Any Sev1 incident.
- Two Sev2 incidents within a 4-hour window.
- Abuse checks fail to enforce expected rate-limit behavior.
- Media upload validation failures observed in production logs.

## Go/No-Go Inputs

- CI evidence
- Ops dashboard snapshots
- Load/security test reports
- Incident status and ownership
