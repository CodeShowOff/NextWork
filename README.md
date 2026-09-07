# NextWork

NextWork is a modern full-stack collaboration platform built as a TypeScript monorepo. It combines a mobile-first product experience with a backend API and shared contract packages to support social collaboration, messaging, groups, notifications, and real-time interactions.

> **Project status:** This repository is retained for reference and learning. Active product development is currently paused.

## Project Overview

The repository contains:

- A cross-platform **Expo/React Native** mobile app
- A **NestJS** backend API with Prisma and PostgreSQL
- Shared **OpenAPI-driven contracts** used across services
- Supporting infrastructure, deployment runbooks, and release validation scripts

## Key Features

Current and core platform capabilities include:

- Authentication and session flows
- Profile and organization-aware social feed
- Posts, comments, reactions, and poll voting
- Group collaboration spaces (files, albums, events entry points)
- Real-time chat with reconnect and reaction flows
- Notifications with cross-device read-state validation
- API contract synchronization between backend and mobile

## Tech Stack

- **Monorepo:** npm workspaces
- **Mobile:** Expo, React Native, TypeScript, React Navigation, TanStack Query, Zustand, LiveKit
- **Backend:** NestJS, TypeScript, Prisma ORM
- **Data & Realtime:** PostgreSQL, Redis, Socket.IO (+ Redis adapter)
- **Tooling:** ESLint, Jest, Prettier, OpenAPI, Maestro (mobile E2E smoke flows)

## Repository Structure

```text
.
├── mobile-app/           # Expo React Native app (TypeScript)
├── backend-api/          # NestJS API + Prisma
├── packages/
│   └── api-contracts/    # Shared OpenAPI spec + generated types
├── infrastructure/       # Docker and environment infrastructure assets
├── documentation/        # Architecture, scripts, deployment, release docs
├── notes/                # Product/feature planning notes
└── scripts/              # Cross-workspace verification and gate scripts
```

## Getting Started

### Prerequisites

- Node.js **20+**
- npm **10+**
- PostgreSQL and Redis (for backend runtime)
- Android Studio / Xcode tooling as needed for mobile development

### Install dependencies

```bash
npm install
```

### Environment setup

- Backend: configure `backend-api/.env` (and `.env.production` for deployments)
- Mobile: configure `mobile-app/.env` from `mobile-app/.env.example`

For full environment and production variables, see `documentation/deployment-runbook.md`.

## Development Scripts

Run from repository root unless noted.

### Monorepo quality and contracts

```bash
npm run lint
npm run typecheck
npm run test
npm run contracts:generate
npm run contracts:check
npm run release:gates
```

### Backend

```bash
npm run bootstrap --workspace backend-api
npm run dev --workspace backend-api
npm run test:integration --workspace backend-api
```

### Mobile

```bash
npm run dev --workspace mobile-app
npm run dev:android --workspace mobile-app
npm run android:debug --workspace mobile-app
npm run android:connect:all --workspace mobile-app
```

## Testing

The repo includes layered validation for release confidence:

- Workspace linting, type checks, and Jest tests
- Backend integration tests (`backend-api`)
- OpenAPI contract generation and drift checks
- Security/load/abuse/performance scripts under `scripts/`

Common gate commands:

```bash
npm run release:gates
npm run test:security
npm run test:e2e:verify
npm run release:check
```

## Mobile E2E

Mobile E2E smoke flows are in `mobile-app/e2e/maestro/` and cover auth recovery, feed/post lifecycle, messaging resilience, invite/group journeys, poll regression, navigation, and notifications synchronization.

- Inventory check used by release gates:

```bash
npm run test:e2e:verify
```

- Manual Maestro execution docs:
  - `mobile-app/e2e/README.md`

## Deployment Notes

- Backend deployment and environment checklist: `documentation/deployment-runbook.md`
- Render monorepo deployment config: `render.yaml`
- Mobile release builds:
  - Android preview APK: `npm run android:apk --workspace mobile-app`
  - iOS preview build (EAS cloud): `npm run ios:ipa --workspace mobile-app`

Recommended pre-deploy checks:

```bash
npm ci
npm run release:gates
npm run test:security
npm run test:e2e:verify
```

## Documentation

- Architecture: `documentation/architecture-overview.md`
- Command references: `documentation/commands/README.md`
- Local DB/Prisma/Redis setup: `documentation/local-db-prisma-redis-runbook.md`
- Deployment and rollout:
  - `documentation/deployment-runbook.md`
  - `documentation/production-readiness-runbook.md`
  - `documentation/release-rollout-plan.md`
  - `documentation/go-live-signoff.md`

## Project Status

NextWork is currently **not in active development**. The codebase is preserved as a full-stack reference implementation of the platform architecture, workflows, and release practices.
