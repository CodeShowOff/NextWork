# PostgreSQL Beginner Guide (For This Project)

This guide explains how PostgreSQL is used in this codebase and what to run for setup and verification.

## 1. What PostgreSQL Is

PostgreSQL is the primary persistent relational database for the backend.

In this project, it stores:
- Users, profiles, posts, comments
- Messages, notifications
- Organizations, groups, invites

## 2. How This Project Connects to PostgreSQL

Connection is configured by `DATABASE_URL` in:
- `backend-api/.env`

Format:
```env
DATABASE_URL=postgresql://username:password@host:port/database
```

Typical local example:
```env
DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/nextwork
```

## 3. PostgreSQL Checks You Should Know

### Check schema/migration connectivity via Prisma
Run from `backend-api`:
```bash
npm run prisma:migrate:status
```
Use when:
- Verifying DB connectivity
- Verifying migration state

### Check readiness endpoint
Run backend and open:
- `http://localhost:4000/api/v1/health`

Healthy response should include:
- postgres: ok

### Optional direct SQL access (if psql installed)
```bash
psql -h localhost -U postgres -d nextwork
```
Use when:
- Manual SQL checks
- Investigating data directly

## 4. PostgreSQL in Daily Flow

### First-time local setup with existing migrations
From `backend-api`:
```bash
npm run prisma:migrate:deploy
npm run prisma:seed
```

### After pulling migration changes
From `backend-api`:
```bash
npm run prisma:migrate:deploy
```

### After local DB reset
From `backend-api`:
```bash
npm run prisma:migrate:deploy
npm run prisma:seed
```

## 5. Common PostgreSQL Problems

### Authentication failed (P1000)
Cause:
- Wrong password/user in `DATABASE_URL`

Fix:
1. Verify postgres credentials
2. Update `backend-api/.env`
3. Retry:
```bash
npm run prisma:migrate:status
```

### Port conflict on 5432
Cause:
- Another service uses port 5432

Fix:
- Move PostgreSQL to another port
- Update `DATABASE_URL` with new port

### Backend health says postgres degraded
Cause:
- DB service down, wrong credentials, or wrong host/port

Fix:
1. Ensure PostgreSQL service is running
2. Verify `DATABASE_URL`
3. Re-run `npm run prisma:migrate:status`

## 6. Best Practices

1. Treat migration files as source of truth for schema history.
2. Commit schema and migration files together.
3. Avoid ad-hoc manual table edits in production.
4. Run migrate status before release.

## 7. Related Docs

- `documentation/prisma-beginner-guide.md`
- `documentation/redis-beginner-guide.md`
- `documentation/local-db-prisma-redis-runbook.md`
