# Backend API Scripts

Source:
- `backend-api/package.json`

Run these from `backend-api` unless noted.

## 1. App Runtime

### `npm run dev`
Command:
```bash
nest start --watch
```
What it does:
- Starts backend in watch mode for local development
When to run:
- Daily development

### `npm run build`
Command:
```bash
nest build
```
What it does:
- Compiles backend into `dist`
When to run:
- Before production startup
- Before packaging

### `npm run start`
Command:
```bash
node dist/main.js
```
What it does:
- Runs compiled backend build
When to run:
- Production-like or deployment runtime

## 2. Code Quality

### `npm run lint`
Command:
```bash
eslint "src/**/*.ts"
```
What it does:
- Lints backend TypeScript source files
When to run:
- Before commit

### `npm run typecheck`
Command:
```bash
tsc --noEmit
```
What it does:
- Type checks backend without output files
When to run:
- Before PR
- After refactors

## 3. Tests

### `npm run test`
Command:
```bash
jest --config jest.config.ts
```
What it does:
- Runs all backend tests
When to run:
- Before merge/release

### `npm run test:unit`
Command:
```bash
jest --config jest.config.ts --testPathPatterns src/.*\.spec\.ts$
```
What it does:
- Runs unit tests under source specs
When to run:
- Fast local validation during feature work

### `npm run test:integration`
Command:
```bash
jest --config jest.config.ts --testPathPatterns test/.*\.int-spec\.ts$
```
What it does:
- Runs integration test suite
When to run:
- Before release
- After endpoint/DB behavior changes

## 4. OpenAPI and Contracts

### `npm run openapi:export`
Command:
```bash
ts-node src/scripts/export-openapi.ts
```
What it does:
- Generates OpenAPI spec used by contracts package
When to run:
- After API/controller/DTO changes

## 5. Prisma and Database

### `npm run bootstrap`
Command:
```bash
npm run prisma:migrate:deploy && npm run prisma:seed
```
What it does:
- Applies migrations and seeds data
When to run:
- First local setup
- After pulling new migrations

### `npm run prisma:generate`
Command:
```bash
prisma generate
```
What it does:
- Regenerates Prisma client
When to run:
- After schema changes
- After Prisma package upgrade

### `npm run prisma:migrate:dev`
Command:
```bash
prisma migrate dev
```
What it does:
- Creates and applies a new migration for local schema changes
When to run:
- During development when schema changes
Example:
```bash
npm run prisma:migrate:dev -- --name add_profile_field
```

### `npm run prisma:migrate:deploy`
Command:
```bash
prisma migrate deploy
```
What it does:
- Applies pending migration files to database
When to run:
- Startup/bootstrap
- CI/CD/deployment

### `npm run prisma:migrate:status`
Command:
```bash
prisma migrate status
```
What it does:
- Shows migration health and schema alignment
When to run:
- Before release
- During DB troubleshooting

### `npm run prisma:sync`
Command:
```bash
prisma db push
```
What it does:
- Direct schema sync without migration file creation
When to run:
- Local experimental sync only

### `npm run prisma:studio`
Command:
```bash
prisma studio
```
What it does:
- Opens Prisma Studio UI to inspect data
When to run:
- Manual DB inspection/debugging

### `npm run prisma:seed`
Command:
```bash
ts-node prisma/seed.ts
```
What it does:
- Inserts initial/project seed data
When to run:
- After DB reset
- First setup

## 6. Optional Docker Service Helpers

### `npm run docker:up`
Command:
```bash
docker compose -f ../infrastructure/docker-compose.yml up -d
```
What it does:
- Starts containerized local services (optional)
When to run:
- If using Docker-based local stack

### `npm run docker:down`
Command:
```bash
docker compose -f ../infrastructure/docker-compose.yml down
```
What it does:
- Stops containerized local services
When to run:
- End of Docker-based local session

### `npm run bootstrap:docker`
Command:
```bash
npm run docker:up && npm run bootstrap
```
What it does:
- Starts Docker services then runs migration + seed bootstrap
When to run:
- One-command Docker setup flow

## 7. Recommended Sequences

### Daily local start
```bash
npm run bootstrap
npm run dev
```

### After schema change
```bash
npx prisma validate
npm run prisma:generate
npm run prisma:migrate:dev -- --name describe_change
npm run test
```

### Before backend release
```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run prisma:migrate:status
```
