# STATE — current position

> Single source of truth for "where are we now". Decisions move from here into an ADR and
> `PROJECT.md` once the user makes them.
>
> **Updated:** 2026-10-02

## Phase

Slices 0–4 are done: a parent buys a course, the student opens the activation link and
creates an account, and from then on signs in, sees their courses and lessons, opens a
lesson and signs out. The brief's journey works end to end. Next is slice 5 (optional: add
a course to an existing account, ADR 005), then slice 6 (README and delivery, mandatory).

Carried forward from the slice 4 reviews:
- The compose check and the browser walk-through were done by hand; slice 6 repeats them
  from a clean clone following the README.
- `/login` now exists, which is what the code-through-login flow of ADR 005 needs.

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
- Redemption: student first, then a claim bound to the student; resumable (ADR 022)
- Onboarding contract: one form, one request (ADR 023)
- No signing secret in the repository (ADR 024)
- LMS contract and access rule: enrolment-scoped reads, 404 for anything else (ADR 025)
- Login and logout contract (ADR 026)

## Open decisions

Each needs the user's call before any code depends on it.

**Product**
- ADR 005 says a taken username at activation should lead to "this account exists, log in"
  with the code carried through login; ADR 023 (slice 3) shows "That username is taken.
  Choose another." The two meet in slice 5; decide there which wording wins.

**Technical**
- Whether a failed charge answers 502 instead of the default 500 (unreachable with the mock
  gateway).

## Blockers

None.
