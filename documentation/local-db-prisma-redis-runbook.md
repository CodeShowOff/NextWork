# Local Database, Prisma, and Redis Runbook (Docker-Free First)

If you are new to Prisma/Redis/PostgreSQL, read this first:
- `documentation/postgresql-prisma-redis-beginner-guide.md`

This runbook documents the full local setup and maintenance flow for PostgreSQL, Redis, and Prisma in sequential order.

Use this runbook when:
- Setting up the backend for the first time
- Verifying local database health after environment changes
- Upgrading Prisma packages
- Troubleshooting local DB or Redis connection issues

## 1. Prerequisites

Make sure these are available locally:
- Node.js and npm
- PostgreSQL running locally (default: localhost:5432)
- Redis running locally (default: localhost:6379)

Environment file required:
- backend-api/.env

Critical variables in backend-api/.env:
- DATABASE_URL=postgresql://<user>:<password>@localhost:5432/nextwork
- REDIS_URL=redis://localhost:6379

## 2. Install Project Dependencies

Run from nextwork root:

```bash
npm install
```

If backend dependencies need refresh specifically:

```bash
cd backend-api
npm install
```

When to run:
- First setup
- After pulling dependency-related changes
- After package.json changes

## 3. Prisma Setup (First Run)

Change to backend folder:

```bash
cd backend-api
```

### 3.1 Validate Prisma schema

```bash
npx prisma validate
```

What it does:
- Parses and validates prisma/schema.prisma
- Catches schema syntax and model relation errors early

### 3.2 Generate Prisma Client

```bash
npm run prisma:generate
```

What it does:
- Regenerates typed Prisma client from schema
- Must be run after schema changes or Prisma package upgrades

### 3.3 Apply migrations to database

```bash
npm run prisma:migrate:deploy
```

What it does:
- Applies versioned SQL migrations from prisma/migrations to the connected DB
- This is the recommended production-safe path and current default for this project

### 3.4 Push schema to database (optional utility)

```bash
npm run prisma:sync
```

What it does:
- Applies current schema state directly with db push (without creating migration files)
- Use only for rapid local experiments, not as the primary release workflow

### 3.5 Seed data

```bash
npm run prisma:seed
```

What it does:
- Inserts initial seed records (for example: initial admin user)
- Safe to rerun if seed script is idempotent

## 4. Verify Prisma and Database Health

### 4.1 Check Prisma versions

```bash
npx prisma -v
```

What to confirm:
- prisma and @prisma/client versions match expected versions

### 4.2 Check migration status

```bash
npx prisma migrate status
```

Interpretation:
- Database schema is up to date means the migration chain and live DB are aligned
- If there are pending migrations, run prisma:migrate:deploy

### 4.3 Open Prisma Studio

```bash
npm run prisma:studio
```

What to verify in Studio:
- Tables are present
- Seeded records exist (for example, users table has at least one row)

## 5. Start Backend and Verify Runtime

Start backend API:

```bash
npm run dev
```

Open health endpoint:
- http://localhost:4000/api/v1/health

Healthy response expectation:
- status is ok
- postgres is ok
- redis is ok

If this is healthy, backend + PostgreSQL + Redis + Prisma wiring is good.

## 6. Run Validation and Test Suites

### 6.1 Type check

```bash
npm run typecheck
```

### 6.2 Full backend tests

```bash
npm run test
```

### 6.3 Integration-only tests (optional)

```bash
npm run test:integration
```

When to run:
- Before commit
- Before release
- After upgrading Prisma or changing schema logic

## 7. Keep Prisma Versions Current (Upgrade Only)

### 7.1 Check latest versions

```bash
npm view prisma version
npm view @prisma/client version
```

### 7.2 Upgrade both together

Run in backend-api:

```bash
npm install prisma@latest @prisma/client@latest
```

### 7.3 Regenerate, migrate, retest

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run test
```

Why this sequence matters:
- generate updates client API
- migrate deploy applies tracked SQL changes to DB
- test validates runtime behavior after upgrade

## 8. Daily Commands (Fast Path)

After first-time setup, normal daily flow is:

```bash
cd backend-api
npm run bootstrap
npm run dev
```

bootstrap runs:
- prisma:migrate:deploy
- prisma:seed

## 9. Common Errors and Fixes

### 9.1 P1000 Authentication failed

Cause:
- DATABASE_URL credentials do not match your PostgreSQL user/password

Fix:
- Verify PostgreSQL credentials with psql
- Update backend-api/.env DATABASE_URL
- Retry:

```bash
npm run prisma:migrate:deploy
```

### 9.2 Cannot connect to Redis

Cause:
- Redis service not running or wrong REDIS_URL

Fix:
- Start Redis service
- Verify:

```bash
redis-cli ping
```

Expected: PONG

### 9.3 Port conflict on 5432 or 6379

Cause:
- Another process already uses PostgreSQL/Redis port

Fix:
- Change service port in local DB/Redis configuration
- Update backend-api/.env URLs accordingly

### 9.4 Schema changed and migration not created yet

Fix:

```bash
npm run prisma:generate
npm run prisma:migrate:dev -- --name describe_change_here
npm run prisma:migrate:deploy
```

### 9.5 npm run dev fails with EADDRINUSE on 4000

Cause:
- Another backend process is already running

Fix:
- Stop existing process or change PORT in backend-api/.env

### 9.6 Queue name cannot contain ':'

Cause:
- BullMQ queue naming restrictions in current runtime

Fix already applied in code:
- backend-api/src/common/reliability/background-jobs.service.ts

## 10. Docker-Free and Optional Docker Scripts

Current backend scripts:
- Docker-free local bootstrap: npm run bootstrap
- Migration status: npm run prisma:migrate:status
- New migration in development: npm run prisma:migrate:dev -- --name <change_name>
- Optional Docker bootstrap: npm run bootstrap:docker
- Optional Docker up/down: npm run docker:up and npm run docker:down

These scripts are defined in:
- backend-api/package.json

Use Docker only if you want containerized local services. Local installed PostgreSQL + Redis is fully supported.

## 11. Recommended Full Verification Sequence

Run this exact sequence in backend-api when you want a complete health pass:

```bash
npm install
npx prisma validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npx prisma -v
npm run prisma:migrate:status
npm run typecheck
npm run test
npm run test:integration
```

Then run the API and confirm health endpoint:

```bash
npm run dev
```

Open:
- http://localhost:4000/api/v1/health

## 12. Prisma Migrate Baseline

This repository is now baseline-managed with Prisma Migrate.

Baseline folder:
- backend-api/prisma/migrations/20260319000100_baseline

Effect:
- migrate status is now authoritative for schema state
- Future schema changes should be introduced through prisma migrate dev
