# STATE — current position

> Single source of truth for "where are we now". Decisions move from here into an ADR and
> `PROJECT.md` once the user makes them.
>
> **Updated:** 2026-10-02

## Phase

Slices 0–6 are done and the README is delivered. Slice 7 is in progress: two changes asked
for after delivery — the same course for two different years on one account (ADR 028), and
the activation link opening "Add a course" for a signed-in student (ADR 029). Full
pipeline with `security-reviewer`.

Left for the user: make the GitHub repository public (DEL-1).

Known and not fixed, listed in the README as limitations:
- A failed charge answers the default 500 (unreachable with the mock gateway).
- `ActivationService.confirm` is conditioned on "claimed by anyone", not on the student
  just enrolled; safe through the claim invariant, noted by `security-reviewer` as Low.
- The SPA's `index.html` is served without a `Cache-Control` header, so a browser may show
  a previous build until a reload.

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
- Adding a course to an existing account: smallest variant, release on a late duplicate
  (ADR 027)
- A duplicate is the same course and year; one enrolment per course and year (ADR 028)
- The activation link forwards a signed-in student to "Add a course", prefilled (ADR 029)

## Open decisions

None.

## Blockers

None.
