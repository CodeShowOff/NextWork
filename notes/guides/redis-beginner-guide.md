# Redis Beginner Guide (For This Project)

This guide explains where Redis fits in this app, how to verify it, and what to run when issues happen.

## 1. What Redis Is

Redis is a fast in-memory datastore.

In this project, Redis is used for:
- Caching
- Rate limiting
- Background queue/reliability features
- Realtime support-related infrastructure

Redis is not the primary durable data store here. PostgreSQL is.

## 2. How This Project Connects to Redis

Redis connection is configured in:
- `backend-api/.env`

Variable:
```env
REDIS_URL=redis://localhost:6379
```

## 3. Redis Health Checks

### Quick Redis ping (if redis-cli is installed)
```bash
redis-cli ping
```
Expected output:
```text
PONG
```

### App readiness check
Start backend and open:
- `http://localhost:4000/api/v1/health`

Healthy response should include:
- redis: ok

## 4. Redis in Daily Flow

Daily flow usually does not need extra Redis command if service auto-starts.

Common sequence:
1. Ensure Redis service is running
2. Run backend bootstrap/start from `backend-api`
```bash
npm run bootstrap
npm run dev
```
3. Verify health endpoint

## 5. Common Redis Problems

### Cannot connect to Redis
Cause:
- Redis service not running
- Wrong `REDIS_URL`

Fix:
1. Start Redis service
2. Confirm `REDIS_URL` in `backend-api/.env`
3. Run `redis-cli ping`
4. Recheck backend health endpoint

### Port conflict on 6379
Cause:
- Another process uses default Redis port

Fix:
- Change Redis port in service config
- Update `REDIS_URL` accordingly

### Backend starts but health shows redis degraded
Cause:
- Redis unavailable or connection mismatch

Fix:
1. Verify Redis process/service running
2. Verify `REDIS_URL`
3. Restart backend

## 6. Best Practices

1. Keep Redis URL in env, never hardcode credentials.
2. Use Redis for transient/fast operations, not primary durable storage.
3. Validate redis health before load or realtime tests.

## 7. Related Docs

- `documentation/postgresql-beginner-guide.md`
- `documentation/prisma-beginner-guide.md`
- `documentation/local-db-prisma-redis-runbook.md`
