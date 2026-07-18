# NextWork Monorepo

![NextWork](https://img.shields.io/badge/Project-NextWork-blue?style=for-the-badge)
![NestJS](https://img.shields.io/badge/Backend-NestJS-e0234e?style=for-the-badge&logo=nestjs)
![React Native](https://img.shields.io/badge/Mobile-React_Native-61dafb?style=for-the-badge&logo=react)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql)
![Prisma](https://img.shields.io/badge/ORM-Prisma-2d3748?style=for-the-badge&logo=prisma)

Welcome to the **NextWork** monorepo! 

## 📖 About

NextWork is a modern, full-stack application built to deliver a seamless experience across mobile and web interfaces. This repository houses the entire ecosystem, containing the backend services, mobile application, shared API contracts, infrastructure configuration, and operational documentation needed to run and scale the platform.

## 🚀 Project Areas

1. **Backend API** (`/backend-api`)
   - **Stack:** NestJS + Prisma + PostgreSQL + Redis
   - Serves all primary REST endpoints, WebSockets, and data access logic.

2. **Mobile App** (`/mobile-app`)
   - **Stack:** React Native (Expo) + Zustand + React Query + LiveKit
   - A full-featured mobile client targeting both iOS and Android.

3. **Shared API Contracts** (`/packages/api-contracts`)
   - Holds shared types, OpenAPI specs, and generated clients to ensure type safety across the stack.

4. **Infrastructure and Monitoring** (`/infrastructure`)
   - Docker configurations, Prometheus, and Grafana dashboards for local and production deployments.

5. **Documentation** (`/documentation`)
   - Detailed guides, command references, and rollout runbooks.

---

## 🛠️ Quick Start (Local Development)

### 1. Root Setup
First, install all monorepo dependencies from the root directory:
```bash
npm install
```

### 2. Start the Backend
The backend requires a database and cache. It uses a migration-first Prisma flow.
```bash
cd backend-api
npm run bootstrap  # Sets up the DB, applies migrations, and seeds data
npm run dev        # Starts the NestJS development server
```
*Health Check: Verify it is running at [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)*

### 3. Start the Mobile App
In a new terminal window, start the Expo bundler:
```bash
cd mobile-app
npm run dev        # Starts the Expo development server
```
*You can press `a` to open in an Android emulator, or `i` for iOS simulator.*

*(Optional) If testing on a physical Android device, you may need to reverse the ports so the app can reach your local backend:*
```bash
cd mobile-app
npm run android:connect:all
```

---

## 📚 Documentation Map

### Start Here (Data Stack Onboarding)
If you're new to the data stack, check out our beginner guides:
- [Prisma Beginner Guide](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/prisma-beginner-guide.md)
- [PostgreSQL Beginner Guide](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/postgresql-beginner-guide.md)
- [Redis Beginner Guide](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/redis-beginner-guide.md)
- [Combined Beginner Context](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/postgresql-prisma-redis-beginner-guide.md)

### Command References
- [Command Docs Index](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/commands/README.md)
- [NextWork Root Scripts](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/commands/nextwork-root-scripts.md)
- [Backend Scripts](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/commands/backend-api-scripts.md)
- [Mobile Scripts](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/commands/mobile-app-scripts.md)

### Release and Production Docs
- [Deployment Runbook](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/deployment-runbook.md)
- [Production Readiness Runbook](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/production-readiness-runbook.md)
- [Release Rollout Plan](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/release-rollout-plan.md)
- [Go-Live Signoff](file:///c:/Users/shukr/Desktop/Projects/Workplace/documentation/go-live-signoff.md)

---

## ✅ Common Root Commands

You can run these utility commands from the monorepo root:

1. **Lint all workspaces:**
   ```bash
   npm run lint
   ```
2. **Typecheck all workspaces:**
   ```bash
   npm run typecheck
   ```
3. **Test all workspaces:**
   ```bash
   npm run test
   ```
4. **Run release gates (Full CI Validation):**
   ```bash
   npm run release:gates
   ```

## 📝 Notes
- Docker is optional for local development but supported via `/infrastructure`.
- The `mobile-app` workspace uses React Native WebRTC and LiveKit for real-time media.
