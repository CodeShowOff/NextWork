# ADR 0002: Feature Scope Lock and Phase Gates

- Status: Accepted
- Date: 2026-03-16
- Deciders: backend lead, mobile lead, product owner

## Context

The platform has core social features implemented, but several product-critical capabilities are still partial or missing (stories, reels, advanced post types, richer media and messaging depth). Prior audits became stale because there was no formal scope-lock artifact with phase ownership and acceptance gates.

## Decision

Adopt a single source of truth for incomplete feature delivery:

1. `documentation/phase-1-feature-contract.md` is the authoritative scope contract.
2. Each capability row in the contract must define API contract, data model contract, and UX behavior contract.
3. Contract priority and non-goals are authoritative for planning and triage.
4. Product and engineering signoff in the contract is required before phase execution starts.
5. Backend module roadmap for planned domains is documented in `backend-api/src/app.module.ts` as non-runtime notes.
6. Deferred items are explicit and cannot be implied by omission.

## Consequences

### Positive

- Reduces audit drift between documentation and implementation.
- Gives engineering and QA unambiguous completion criteria.
- Makes release decisions auditable by phase and capability.

### Negative

- Requires disciplined updates whenever scope changes.
- Adds process overhead for introducing late feature requests.

## Follow-up Actions

1. Build phase execution tickets directly from the contract matrix.
2. Ensure each phase PR references the contract capability row it implements.
3. Reject phase signoff when acceptance gate evidence is missing.
