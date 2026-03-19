# Prisma Beginner Guide (For This Project)

This guide explains Prisma basics and exactly which command to run in common situations.

Scope:
- Prisma schema
- Prisma client generation
- Migrations workflow
- Seeding
- Daily command flow

## 1. What Prisma Is

Prisma is a TypeScript-friendly ORM and database toolkit.

In this project, Prisma does four things:
1. Defines database models in `backend-api/prisma/schema.prisma`
2. Generates typed client code for database queries
3. Manages migration SQL files in `backend-api/prisma/migrations/`
4. Runs seed script for initial data (`backend-api/prisma/seed.ts`)

## 2. Important Files

1. Schema file:
- `backend-api/prisma/schema.prisma`

2. Migration folder:
- `backend-api/prisma/migrations/`

3. Seed script:
- `backend-api/prisma/seed.ts`

4. Prisma config:
- `backend-api/prisma.config.ts`

## 3. Prisma Commands and When to Run Them

Run these from `backend-api`.

### `npx prisma validate`
What it does:
- Validates Prisma schema syntax and relations

When to run:
- After editing `schema.prisma`
- Before creating migration

### `npm run prisma:generate`
What it does:
- Regenerates Prisma Client code

When to run:
- After schema changes
- After Prisma package upgrades

### `npm run prisma:migrate:dev -- --name <change_name>`
What it does:
- Creates migration SQL from schema changes
- Applies migration locally

When to run:
- During development whenever schema changes

### `npm run prisma:migrate:deploy`
What it does:
- Applies existing migration files to current DB

When to run:
- App bootstrap
- CI/CD or production deploy
- After pulling teammate migration commits

### `npm run prisma:migrate:status`
What it does:
- Shows if database schema is aligned with migration history

When to run:
- Before release
- During database troubleshooting

### `npm run prisma:seed`
What it does:
- Inserts starter/seed data

When to run:
- First setup
- After database reset

### `npm run prisma:studio`
What it does:
- Opens Prisma Studio browser UI for table/row inspection

When to run:
- Manual data checks
- Debugging records

### `npm run prisma:sync` (optional utility)
What it does:
- Runs `prisma db push` (direct schema sync without migration files)

When to run:
- Local quick experiments only

Avoid using this as your primary release workflow.

## 4. Recommended Workflows

### First setup
```bash
cd backend-api
npx prisma validate
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run prisma:migrate:status
```

### Daily start
```bash
cd backend-api
npm run bootstrap
npm run dev
```

### After changing schema
```bash
cd backend-api
npx prisma validate
npm run prisma:generate
npm run prisma:migrate:dev -- --name describe_change
npm run test
```

### After upgrading Prisma packages
```bash
cd backend-api
npm install prisma@latest @prisma/client@latest
npm run prisma:generate
npm run prisma:migrate:deploy
npm run test
```

## 5. Common Prisma Errors

### P1000 authentication failed
Cause:
- `DATABASE_URL` credentials mismatch

Fix:
- Correct DB username/password in `backend-api/.env`
- Retry `npm run prisma:migrate:status`

### migrate status says not up to date
Cause:
- Pending migration files not applied

Fix:
- Run `npm run prisma:migrate:deploy`

### Prisma client/runtime mismatch
Cause:
- Generated client outdated after schema/package change

Fix:
- Run `npm run prisma:generate`

## 6. Related Docs

- `documentation/postgresql-beginner-guide.md`
- `documentation/redis-beginner-guide.md`
- `documentation/local-db-prisma-redis-runbook.md`
- `documentation/commands/backend-api-scripts.md`
