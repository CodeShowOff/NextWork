# Workplace Monorepo

This repository contains backend, mobile app, shared contracts, infrastructure, and release/operations documentation.

## Project Areas

1. Backend API
- Path: `backend-api`
- Stack: NestJS + Prisma + PostgreSQL + Redis

2. Mobile App
- Path: `mobile-app`
- Stack: React Native + Expo

3. Shared API Contracts
- Path: `packages/api-contracts`

4. Infrastructure and Monitoring
- Path: `infrastructure`

5. Documentation
- Path: `documentation`

## Documentation Map

### Start Here (Data stack onboarding)

1. Prisma beginner guide
- `documentation/prisma-beginner-guide.md`

2. PostgreSQL beginner guide
- `documentation/postgresql-beginner-guide.md`

3. Redis beginner guide
- `documentation/redis-beginner-guide.md`

4. Combined beginner context
- `documentation/postgresql-prisma-redis-beginner-guide.md`

5. Operational runbook (strict sequence)
- `documentation/local-db-prisma-redis-runbook.md`

### Command References

1. Command docs index
- `documentation/commands/README.md`

2. Workspace root scripts
- `documentation/commands/workspace-root-scripts.md`

3. Backend scripts
- `documentation/commands/backend-api-scripts.md`

4. Mobile scripts
- `documentation/commands/mobile-app-scripts.md`

### Release and Production Docs

1. Deployment runbook
- `documentation/deployment-runbook.md`

2. Production readiness runbook
- `documentation/production-readiness-runbook.md`

3. Release rollout plan
- `documentation/release-rollout-plan.md`

4. Go-live signoff
- `documentation/go-live-signoff.md`

## Quick Start (Local)

1. Install dependencies at root:
```bash
npm install
```

2. Bootstrap backend database and seed:
```bash
cd backend-api
npm run bootstrap
```

3. Start backend:
```bash
npm run dev
```

4. Verify backend health:
- `http://localhost:4000/api/v1/health`

## Common Root Commands

1. Lint all workspaces:
```bash
npm run lint
```

2. Typecheck all workspaces:
```bash
npm run typecheck
```

3. Test all workspaces:
```bash
npm run test
```

4. Run release gates:
```bash
npm run release:gates
```

## Notes

1. Docker is optional for local development in this project.
2. Migration-first Prisma flow is enabled for backend database schema management.
