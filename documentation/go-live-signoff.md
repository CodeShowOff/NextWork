# Go-Live Signoff (Phase 5)

Date: 2026-03-17
Release scope: Phase 5 Stabilization, Testing, and Rollout
Owners: Mobile Lead, Backend Lead, QA Lead, Release Manager

## Required Evidence

1. End-to-end regression inventory check passed for auth, feed, poll vote, notifications, and messaging.
2. Mobile unit/integration suite passed with no high-severity failures.
3. Contract compatibility checks passed:
- OpenAPI export and generated SDK remain in sync.
- Mobile SDK wrapper compatibility tests pass.
4. Rollout flags configured for high-risk areas:
- EXPO_PUBLIC_FLAG_AUTH_SESSION_REFRESH
- EXPO_PUBLIC_FLAG_FLASHLIST_RENDERING
5. UAT completed with zero high-severity regressions.

## Test Commands

Run from monorepo root:

```bash
npm run test:e2e:verify
npm run test --workspace mobile-app
npm run contracts:check
npm run test:mobile-perf
```

## UAT Gate

Pass criteria:

- Zero high-severity regressions in auth, feed, poll, notifications, and messaging flows.
- Token refresh race and offline/online transition scenarios validated.
- Pagination behavior remains correct after FlashList rollout or fallback flag switch.

If high-severity regression is found:

- Stop rollout.
- Switch high-risk flag off for affected surface.
- Re-run UAT and evidence capture before proceeding.

## Rollout Controls

Recommended staged plan:

1. Internal users with flags enabled for 24h.
2. Canary cohort with auth refresh flag enabled and list rendering flag monitored for 24h.
3. Progressive rollout to 25%, 50%, and 100% after each successful checkpoint.

## Signoff Checklist

- [ ] QA lead approved
- [ ] Mobile lead approved
- [ ] Backend lead approved
- [ ] Release manager approved

Status: [ ] Approved for production rollout
