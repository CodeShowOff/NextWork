# PostgreSQL, Prisma, and Redis Beginner Guide (For This Project)

This guide is written for developers who are new to Prisma and Redis, or who used PostgreSQL before but want a clear workflow for this codebase.

If you want only the strict command sequence, see:
- `documentation/local-db-prisma-redis-runbook.md`

If you want separate topic-specific guides, see:
- `documentation/prisma-beginner-guide.md`
- `documentation/postgresql-beginner-guide.md`
- `documentation/redis-beginner-guide.md`

---

## 1. Big Picture (Very Simple)

Your backend app uses 3 data pieces:

1. PostgreSQL
- Main long-term database (users, posts, messages, etc.)
- Data persists across restarts

2. Prisma
- Type-safe ORM and DB toolkit for Node.js/TypeScript
- It reads `prisma/schema.prisma` and generates code + SQL migrations

3. Redis
- Fast in-memory datastore
- Used for caching, rate limits, queues, and realtime support

Think of it like this:
- PostgreSQL = permanent storage
- Redis = fast temporary storage
- Prisma = bridge between your TypeScript code and PostgreSQL

---

## 2. Core Concepts You Should Know

### 2.1 Prisma Schema
File:
- `backend-api/prisma/schema.prisma`

What it contains:
- Models (tables), relations, indexes
- Datasource (PostgreSQL)
- Generator (Prisma Client)

### 2.2 Prisma Client
Generated TypeScript/JS client used in app code for DB queries.

Command to generate:
```bash
npm run prisma:generate
```

Run it when:
- You changed `schema.prisma`
- You upgraded `prisma` or `@prisma/client`

### 2.3 Migrations
Migration = versioned SQL change file that updates DB schema safely.

Folder:
- `backend-api/prisma/migrations/`

Current project status:
- Baseline migration is already set up
- Use migration flow as primary approach

### 2.4 Seed
Seed script inserts initial data (example admin user).

File:
- `backend-api/prisma/seed.ts`

Command:
```bash
npm run prisma:seed
```

---

## 3. Commands You Will Use Most (With Meaning)

Run these from `backend-api` unless stated otherwise.

### 3.1 Install dependencies
From workspace root:
```bash
npm install
```

When:
- First setup
- After pulling changes with dependency updates

### 3.2 Validate schema
```bash
npx prisma validate
```

What it does:
- Checks schema syntax and relation correctness

When:
- Before creating migration
- After editing schema

### 3.3 Generate Prisma client
```bash
npm run prisma:generate
```

What it does:
- Regenerates Prisma client code used by app

When:
- After schema changes
- After Prisma upgrade

### 3.4 Create a new migration (development)
```bash
npm run prisma:migrate:dev -- --name your_change_name
```

What it does:
- Compares current schema to DB
- Creates migration SQL file
- Applies it locally

When:
- Any time schema changes and you want tracked DB history

### 3.5 Apply existing migrations (deploy/local sync)
```bash
npm run prisma:migrate:deploy
```

What it does:
- Applies pending migrations from migration files

When:
- Startup/bootstrap
- CI/CD
- Production deploy

### 3.6 Check migration status
```bash
npm run prisma:migrate:status
```

What it does:
- Shows if DB schema matches migration history

When:
- After migrate commands
- Before release

### 3.7 Optional direct sync (not primary)
```bash
npm run prisma:sync
```

What it does:
- Uses `db push` to sync schema without creating migration files

When:
- Local fast experimentation only

Avoid as main production workflow.

### 3.8 Seed data
```bash
npm run prisma:seed
```

What it does:
- Inserts initial data required for local app usage

When:
- First setup
- After DB reset

### 3.9 Open Prisma Studio
```bash
npm run prisma:studio
```

What it does:
- Opens UI to browse tables and rows

When:
- Data inspection/debugging

### 3.10 Start backend
```bash
npm run dev
```

Then check:
- `http://localhost:4000/api/v1/health`

Healthy means:
- app ok
- postgres ok
- redis ok

---

## 4. Recommended Day-to-Day Flow

From `backend-api`:

```bash
npm run bootstrap
npm run dev
```

`bootstrap` in this project runs:
1. `npm run prisma:migrate:deploy`
2. `npm run prisma:seed`

Use this as default local startup routine.

---

## 5. If You Change Database Schema (Important)

Example: you add a column to `User` in `schema.prisma`.

Do this sequence:

1. Validate schema
```bash
npx prisma validate
```

2. Generate client
```bash
npm run prisma:generate
```

3. Create migration
```bash
npm run prisma:migrate:dev -- --name add_user_new_field
```

4. Re-run tests
```bash
npm run test
```

5. Commit schema + migration together
- `prisma/schema.prisma`
- `prisma/migrations/.../migration.sql`

---

## 6. PostgreSQL Basics For This Project

### 6.1 What PostgreSQL handles here
- User accounts
- Profiles
- Posts/comments/likes
- Messages/notifications
- Organization/group data

### 6.2 Check PostgreSQL is reachable
Prisma way:
```bash
npm run prisma:migrate:status
```

Manual way (if `psql` installed):
```bash
psql -h localhost -U postgres -d workplace
```

### 6.3 Connection string format
In `backend-api/.env`:
```env
DATABASE_URL=postgresql://username:password@host:port/database
```

Project local default shape:
```env
DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/workplace
```

---

## 7. Redis Basics For This Project

### 7.1 What Redis handles here
- Caching
- Rate limiting
- Queue/reliability features
- Some realtime support infrastructure

### 7.2 Check Redis is up
If `redis-cli` is installed:
```bash
redis-cli ping
```
Expected:
```text
PONG
```

### 7.3 Redis URL format
In `backend-api/.env`:
```env
REDIS_URL=redis://localhost:6379
```

---

## 8. Full First-Time Setup Sequence (Copy/Paste)

From workspace root:

```bash
npm install
cd backend-api
npx prisma validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run prisma:migrate:status
npm run typecheck
npm run test
npm run dev
```

Then open:
- `http://localhost:4000/api/v1/health`

---

## 9. Upgrade Prisma Safely (Latest Only)

From `backend-api`:

1. Check latest versions
```bash
npm view prisma version
npm view @prisma/client version
```

2. Upgrade both together
```bash
npm install prisma@latest @prisma/client@latest
```

3. Regenerate and verify
```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run test
```

---

## 10. Common Errors and Fixes

### 10.1 Error: P1000 authentication failed
Cause:
- Wrong DB password/user in `DATABASE_URL`

Fix:
1. Verify postgres credentials
2. Update `backend-api/.env`
3. Retry:
```bash
npm run prisma:migrate:status
```

### 10.2 Error: Cannot connect to Redis
Cause:
- Redis service down or wrong `REDIS_URL`

Fix:
1. Start Redis service
2. Verify with:
```bash
redis-cli ping
```

### 10.3 Error: Port in use (5432, 6379, or 4000)
Cause:
- Another process is already using the port

Fix:
- Stop conflicting process or change port config
- Update `.env` URLs/PORT accordingly

### 10.4 Error: Queue name cannot contain ':'
Cause:
- BullMQ naming rule

Status:
- Already fixed in:
  - `backend-api/src/common/reliability/background-jobs.service.ts`

---

## 11. Project-Specific Script Reference

Defined in:
- `backend-api/package.json`

Core:
- `npm run bootstrap`
- `npm run prisma:generate`
- `npm run prisma:migrate:dev -- --name <name>`
- `npm run prisma:migrate:deploy`
- `npm run prisma:migrate:status`
- `npm run prisma:seed`
- `npm run prisma:studio`
- `npm run dev`
- `npm run test`
- `npm run test:integration`

Optional Docker path:
- `npm run bootstrap:docker`
- `npm run docker:up`
- `npm run docker:down`

---

## 12. Which Command Should I Run Right Now?

Use this decision helper:

1. New machine / first setup
- Run full first-time setup sequence

2. Starting daily work
- `npm run bootstrap`
- `npm run dev`

3. I edited schema.prisma
- `npx prisma validate`
- `npm run prisma:generate`
- `npm run prisma:migrate:dev -- --name <change_name>`

4. I pulled teammate migration changes
- `npm run prisma:migrate:deploy`

5. I upgraded Prisma packages
- `npm run prisma:generate`
- `npm run prisma:migrate:deploy`
- `npm run test`

6. Health endpoint failing
- Check PostgreSQL and Redis services
- Check `.env` URLs
- Run `npm run prisma:migrate:status`

---

## 13. Related Docs

- Strict operational flow: `documentation/local-db-prisma-redis-runbook.md`
- Deployment flow: `documentation/deployment-runbook.md`
