# NextWork Root Scripts

Source:
- `package.json` (nextwork root)

Run these commands from nextwork root.

## 1. Quality Basics

### `npm run lint`
Command:
```bash
npm run lint --workspaces --if-present
```
What it does:
- Runs lint in all workspaces that define a lint script
When to run:
- Before commit
- Before pull request

### `npm run test`
Command:
```bash
npm run test --workspaces --if-present
```
What it does:
- Runs all nextwork test scripts
When to run:
- Before merge
- After dependency upgrades

### `npm run typecheck`
Command:
```bash
npm run typecheck --workspaces --if-present
```
What it does:
- Runs TypeScript compile checks in workspaces that support it
When to run:
- After refactors
- Before release gates

## 2. API Contracts Flow

### `npm run contracts:sync-spec`
Command:
```bash
npm run openapi:export --workspace backend-api
```
What it does:
- Exports backend OpenAPI spec from backend code
When to run:
- After backend endpoint/schema changes

### `npm run contracts:generate`
Command:
```bash
npm run contracts:sync-spec && npm run generate --workspace @nextwork/api-contracts
```
What it does:
- Syncs OpenAPI spec and regenerates typed API contracts
When to run:
- After API changes
- Before mobile integration updates

### `npm run contracts:check`
Command:
```bash
npm run contracts:sync-spec && npm run check:generated --workspace @nextwork/api-contracts
```
What it does:
- Verifies generated contracts are aligned with current backend API spec
When to run:
- In CI
- Before release

### `npm run contracts:check-fetch`
Command:
```bash
node ./scripts/check-mobile-api-fetch.js
```
What it does:
- Verifies mobile API fetch usage/contracts compatibility
When to run:
- Before mobile release
- After API contract changes

## 3. Formatting

### `npm run format`
Command:
```bash
prettier --write "**/*.{ts,tsx,js,json,md,yml,yaml}"
```
What it does:
- Formats supported files across repo
When to run:
- Before commit if lint/format checks fail
- After large refactors

## 4. CI Gate Commands

### `npm run ci:backend`
Command:
```bash
npm run lint --workspace backend-api && npm run typecheck --workspace backend-api && npm run test --workspace backend-api
```
What it does:
- Runs backend lint, typecheck, and tests
When to run:
- Before backend PR merge
- Before backend release

### `npm run ci:mobile`
Command:
```bash
npm run lint --workspace mobile-app && npm run typecheck --workspace mobile-app && npm run test --workspace mobile-app && npm run contracts:check-fetch && npm run contracts:check
```
What it does:
- Runs mobile checks plus contract compatibility checks
When to run:
- Before mobile PR merge
- Before app store/internal distribution

### `npm run release:gates`
Command:
```bash
npm run ci:backend && npm run ci:mobile
```
What it does:
- Runs top-level backend + mobile quality gates
When to run:
- Before any combined release

## 5. Reliability and Security Test Scripts

### `npm run test:load`
Command:
```bash
node ./scripts/load-test.js
```
What it does:
- Runs load/performance checks
When to run:
- Before production rollout
- After performance-sensitive changes

### `npm run test:security`
Command:
```bash
node ./scripts/security-test.js
```
What it does:
- Runs security-focused checks
When to run:
- Before release
- After auth/security changes

### `npm run test:abuse`
Command:
```bash
node ./scripts/abuse-test.js
```
What it does:
- Runs abuse/negative-scenario checks
When to run:
- Before release
- After rate-limit/validation changes

### `npm run test:mobile-perf`
Command:
```bash
node ./scripts/mobile-perf-regression-check.js --baseline ./documentation/baselines/mobile-perf-baseline.json --current ./documentation/baselines/mobile-perf-current.json --minDroppedFramesImprovement 30 --maxTtfcRegressionMs 0 --maxMemoryCrashIncrease 0
```
What it does:
- Compares current mobile perf metrics against baseline thresholds
When to run:
- Before mobile release
- After UI/render/perf changes

### `npm run test:e2e:verify`
Command:
```bash
node ./scripts/e2e-verify.js
```
What it does:
- Runs E2E verification checks/gates
When to run:
- Before release candidate signoff

## 6. Phase Release Command

### `npm run release:phase9`
Command:
```bash
npm run release:gates && npm run test:integration --workspace backend-api && npm run test:security && npm run test:e2e:verify
```
What it does:
- Runs complete phase-9 release validation chain
When to run:
- Phase 9 release readiness checks

## 7. Suggested Sequences

### Fast local confidence
```bash
npm run typecheck
npm run test
```

### Pre-PR full check
```bash
npm run release:gates
```

### Pre-release hard gate
```bash
npm run release:phase9
```
