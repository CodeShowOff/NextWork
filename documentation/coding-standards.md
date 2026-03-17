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

## API Contract Ownership And Freeze Policy

### Source Of Truth

- Backend OpenAPI output is the source of truth for API contracts.
- `packages/api-contracts` is the distribution layer for shared contract types and generated SDK artifacts.
- Mobile must consume contract package outputs instead of introducing endpoint-specific ad hoc shapes.

### Ownership

- Backend module owner: owns endpoint behavior, OpenAPI annotations, and compatibility notes.
- Contracts owner (platform/backend): owns SDK generation pipeline and package publication within the monorepo.
- Mobile owner: owns consumer integration and must not bypass generated client boundaries except approved upload/network edge cases.

### Change Workflow

- Classify contract changes as additive, compatible update, or breaking.
- Update endpoint implementation and OpenAPI metadata in the same pull request.
- Regenerate SDK/contracts package in the same pull request.
- Update all first-party consumers impacted by the regenerated SDK.
- Document breaking changes in release notes and require explicit approval before merge.

### Freeze Rule (Current Phase)

- Current feature API surface is frozen except bug fixes and explicitly approved additions.
- Breaking API changes are blocked without architecture signoff from backend + mobile leads.

## Auth Token Handling Policy

- Access and refresh tokens must be stored only in OS-backed secure storage.
- In-memory stores (for example Zustand) may cache non-secret session UI state only.
- Logout and auth reset flows must wipe secure storage and in-memory state in the same action path.
- Token values must never be logged, included in analytics payloads, or written to crash metadata.