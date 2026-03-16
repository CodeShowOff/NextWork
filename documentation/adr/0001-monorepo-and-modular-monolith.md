# ADR 0001: Monorepo and Modular Monolith First

## Status
Accepted

## Context

We are migrating from a Flutter + Firebase codebase with mixed concerns and weak module boundaries.
The new system must support team-scale development and predictable growth.

## Decision

- Use a single repository with workspaces for mobile, backend, and shared packages.
- Start backend as a modular monolith in NestJS.
- Enforce strict module boundaries and dependency direction.
- Use PostgreSQL + Redis from day one.

## Consequences

- Faster delivery and lower operational complexity in early phases.
- Clean extraction path into microservices if scale requires it later.
- Stronger consistency in contracts and tooling.
