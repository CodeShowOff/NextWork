# Deployment Runbook

This runbook covers everything needed to make the backend and mobile app deploy-ready.

## 1. Required Services and URLs

Backend service dependencies:

- PostgreSQL (required): `DATABASE_URL`
- Redis (required): `REDIS_URL`
- Optional email provider (Brevo): `BREVO_API_KEY`, `BREVO_API_BASE_URL`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`

Public URL configuration:

- Invite links: `INVITE_LINK_BASE_URL`
- Post share links: `POST_SHARE_BASE_URL`
- Upload endpoint base: `MEDIA_UPLOAD_BASE_URL`
- CDN/public media base: `MEDIA_PUBLIC_BASE_URL`

API runtime endpoints:

- Health live: `/api/v1/health/live`
- Health ready: `/api/v1/health/ready`
- Ops metrics JSON: `/api/v1/ops/metrics`
- Prometheus metrics: `/api/v1/ops/prometheus`
- Swagger docs: `/api/docs`

## 2. Environment Files You Must Prepare

Backend:

1. Copy `backend-api/.env.production.example` to `backend-api/.env.production`.
2. Set strong JWT secrets (32+ chars) and real managed DB/Redis URLs.
3. Never commit `.env.production`.

Mobile:

1. Copy `mobile-app/.env.example` to `mobile-app/.env`.
2. Set rollout flags for your target release channel.

## 3. Pre-Deploy Quality Gates (must pass)

From monorepo root:

1. `npm ci`
2. `npm run release:gates`
3. `npm run test:security`
4. `npm run test:e2e:verify`

If `npm run release:gates` fails at contracts check, run:

- `npm run contracts:generate`
- Commit generated contract files under `packages/api-contracts/`

## 4. Backend Deployment Steps

## 4.1 Provision infra

1. Create managed PostgreSQL and Redis.
2. Open outbound network access from app host to DB and Redis.
3. Put secrets in a secret manager (not plain env in git).

## 4.2 Build backend artifact

From root:

1. `npm ci`
2. `npm run build --workspace backend-api`

## 4.3 Apply DB schema

Before starting new backend version:

1. Set env with production `DATABASE_URL`.
2. `npm run prisma:migrate:deploy --workspace backend-api`

Only for non-production seed environments:

- `npm run prisma:seed --workspace backend-api`

## 4.4 Start backend

Use process manager/systemd/container with command:

- `npm run start --workspace backend-api`

App listens on `PORT` (default 4000).

## 4.5 Post-deploy smoke checks

1. `GET /api/v1/health/live` returns ok.
2. `GET /api/v1/health/ready` returns ok.
3. `GET /api/v1/ops/metrics` returns JSON with request/realtime/background sections.
4. `GET /api/v1/ops/prometheus` returns Prometheus text.

## 5. Mobile Release Steps

## 5.1 Android internal APK

1. `npm ci`
2. `npm run android:apk --workspace mobile-app`
3. Install generated APK on internal testers.

## 5.2 iOS internal build (from Windows)

1. `npm ci`
2. `npm run ios:ipa --workspace mobile-app`
3. Distribute via TestFlight/internal channel from EAS output.

## 5.3 Mobile release validation

1. Login/logout and token refresh flow on real device.
2. Feed, notifications, and messages smoke tests.
3. Ensure mobile can reach production API base URL.

## 6. CI/CD and Rollout

Current CI workflow in `.github/workflows/ci.yml` runs:

1. backend-quality
2. mobile-quality
3. security-gate

Deployment strategy is documented and should be followed:

1. Internal rollout
2. Beta rollout
3. Production rollout

Use these docs for gates and rollback:

- `documentation/production-readiness-runbook.md`
- `documentation/release-rollout-plan.md`
- `documentation/go-live-signoff.md`

## 7. Critical Security Checklist

Before production deployment:

1. Rotate JWT secrets and store in secret manager.
2. Ensure DB and Redis are not publicly exposed.
3. Run `npm run test:security` and fix findings.
4. Validate no secrets are printed in logs.
5. Keep `.env`, `.env.production`, and credential files out of git.
