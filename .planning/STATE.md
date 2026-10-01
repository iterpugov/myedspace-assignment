# STATE — current position

> Single source of truth for "where are we now". Decisions move from here into an ADR and
> `PROJECT.md` once the user makes them.
>
> **Updated:** 2026-10-02

## Phase

Slices 0 and 1 are done: the product page lists the seeded courses and hands the chosen
course and year to `/checkout`, which is still a placeholder. Next is slice 2 (checkout
and activation code), full pipeline with `security-reviewer`, starting with `planner`.

Carried into slice 2 from the slice 1 reviews:
- The API request-validation mechanism is undecided (needed for `courseId` and `year`).
- The integration harness needs a database reset helper once tests start writing rows.

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

## Open decisions

Each needs the user's call before any code depends on it.

**Product**
- None open.

**Technical**
- None open.

## Blockers

None.
