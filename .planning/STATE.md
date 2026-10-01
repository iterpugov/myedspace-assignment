# STATE — current position

> Single source of truth for "where are we now". Decisions move from here into an ADR and
> `PROJECT.md` once the user makes them.
>
> **Updated:** 2026-10-01

## Phase

Setup. Workflow files are in place; no application code yet. Product and technical
decisions are recorded as ADR 001–014 and the roadmap slices are agreed; next is slice 0
(skeleton).

## Decided

- Backend: NestJS (TypeScript)
- Frontend: separate React SPA talking to the API
- Workflow: planner → tdd-guide → implementation → reviewers, semi-auto
- Guest checkout, no parent account (ADR 001)
- Course = subject + year range; parent picks the year at purchase (ADR 002)
- Order = list of student seats, one course each; UI sends one seat (ADR 003)
- Student record is created at onboarding (ADR 004)
- Purchase outcome is a link plus an activation code; the code adds a course to an
  existing account; duplicates are rejected and the code stays valid (ADR 005)
- PostgreSQL + Prisma; migrations and seed in a separate compose service (ADR 006)
- Student logs in with a username (ADR 007)
- JWT in an httpOnly cookie; `scrypt` password hashing (ADR 008)
- Activation code: 15 characters, hashed at rest, single use, no expiry (ADR 009)
- Mock checkout: one request, always approved, no card fields (ADR 010)
- npm workspaces: `api/`, `web/`, types-only `packages/contracts/`; compose services `db`, `migrate`, `api`, `web` (ADR 011)
- Modular monolith on NestJS with five modules, no Java service (ADR 012)
- Tests: Jest + Testcontainers for the API, Vitest + RTL for the SPA (ADR 013)
- SPA tooling: Vite, React Router, TanStack Query, Tailwind, React Hook Form (ADR 014)

## Open decisions

Each needs the user's call before any code depends on it.

**Product**
- None open.

**Technical**
- None open.

## Blockers

None.
