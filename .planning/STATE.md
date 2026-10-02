# STATE — current position

> Single source of truth for "where are we now". Decisions move from here into an ADR and
> `PROJECT.md` once the user makes them.
>
> **Updated:** 2026-10-02

## Phase

Slices 0–3 are done: a parent buys a course, and the student opens the activation link,
creates an account and lands on `/lms`, signed in. `/lms` shows only a welcome, and
`/login` is still a placeholder. Next is slice 4 (LMS: login, logout, dashboard, lessons),
full pipeline with `security-reviewer`, starting with `planner`.

Carried into slice 4 from the slice 3 reviews:
- Every LMS endpoint needs `SessionGuard` and a query scoped to the student's enrolments.
- The dashboard must handle a student with no courses (ADR 022).
- `verifyPassword` exists and is tested but has no caller yet; login uses it.
- Login should answer the same for an unknown username and a wrong password.

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
