# Workplace Monorepo

This repository is the re-architecture target for the legacy Flutter app in ../clone.

## Stack

- Mobile: React Native + TypeScript
- Backend: Node.js + NestJS
- Data: PostgreSQL + Redis
- Realtime: Socket.IO + Redis adapter

## Workspace Layout

- `mobile-app`: React Native application
- `backend-api`: NestJS API and WebSocket gateway
- `infrastructure`: local and deployment infrastructure definitions
- `documentation`: architecture decisions and standards
- `packages`: shared contracts and internal packages

## Phase 1 Goal

Phase 1 establishes production-grade foundations:

- monorepo structure and standards
- backend and mobile skeletons
- architecture documentation
- feature parity tracker for pending/partial legacy features

## Quick Start (after dependencies are installed)

1. Start infrastructure: `docker compose -f infrastructure/docker-compose.yml up -d`
2. Start backend: `npm run dev -w backend-api`
3. Start mobile: `npm run dev -w mobile-app`

## Important Rule

Pending or partially implemented features in the Flutter app (notably notifications and messaging) are tracked in documentation/feature-parity-tracker.md and must be completed before release.
