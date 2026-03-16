# Coding Standards

## Core Principles

- SOLID
- DRY
- KISS
- Separation of Concerns
- High cohesion, low coupling

## Backend Rules (NestJS)

- Each module follows `controller -> service -> repository interface -> infra repository`.
- DTOs are required for all public write/read contracts.
- ValidationPipe is enabled globally with whitelist and transform.
- No module reaches directly into another module's repository.
- Cross-module communication uses explicit service contracts or domain events.

## Mobile Rules (React Native)

- Feature-sliced folders with clear ownership.
- Server state via React Query; local UI state via lightweight store.
- Screens are thin; hooks/services own business logic.
- Do not embed API URLs in UI code.

## Testing Baseline

- Unit tests for service/hook logic.
- Integration tests for API module boundaries.
- E2E for critical user journeys.

## Documentation Discipline

- Every major architecture decision gets an ADR in `documentation/adr`.
- Feature additions must update parity tracker and API contract docs.
