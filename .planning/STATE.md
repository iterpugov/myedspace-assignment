# STATE — current position

> Single source of truth for "where are we now". Decisions move from here into an ADR and
> `PROJECT.md` once the user makes them.
>
> **Updated:** 2026-10-02

## Phase

Slices 0–2 are done: a parent picks a course and year, pays through the mock checkout and
gets an activation code and link. The link opens `/activate`, which is still a placeholder.
Next is slice 3 (onboarding), full pipeline with `security-reviewer`, starting with
`planner`.

Carried into slice 3 from the slice 2 reviews:
- Validate the code's shape and cap its length before hashing.
- Remove `#code=` from the address with `history.replaceState` once it is read.
- Single use must be enforced by a database constraint (ADR 009).
- Decide whether an unknown code and a redeemed code get the same response.
- Whether a failed charge should answer 502 instead of the default 500 is undecided.

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
- Toolchain: NestJS 11, Prisma 7.10.0, TypeScript 5.9.3 (ADR 015)
- SPA follows the MyEdSpace visual language, described in `web/DESIGN_SYSTEM.md` (ADR 016)
- Catalogue contract: UUID ids, pence, selection in the URL (ADR 017)
- Request validation: `class-validator` + global `ValidationPipe` (ADR 018)
- An activation code row carries its own course and year (ADR 019)
- The plain code is never logged; router state and a URL fragment carry it (ADR 020)
- Codes are issued before the order is saved; no shared transaction (ADR 021)

## Open decisions

Each needs the user's call before any code depends on it.

**Product**
- None open.

**Technical**
- None open.

## Blockers

None.
