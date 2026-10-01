# PROJECT — MyEdSpace take-home

A mock of the MES core user journey — parent purchases, student onboards, student accesses
the LMS — built to show system structure, technical decisions and pragmatic use of AI
tooling. Full brief: [`../task.txt`](../task.txt).

## Constraints (from the brief)

- **Time box:** 3–4 hours. Clarity and pragmatism over completeness.
- **Stack alignment:** React frontend; Java or Node.js backend.
- **Runs with one command:** `docker compose up` starts every required service.
- **Mocked parts:** no real payment integration; no real auth system required.
- **Deliverables:** source code, Docker setup, README (architecture overview, key
  decisions, AI usage with artefacts).

## Stack

| Part | Technology | Status |
|------|------------|--------|
| Backend API | TypeScript / NestJS | decided |
| Frontend | TypeScript / React SPA, separate from the API | decided |
| Persistence | PostgreSQL / Prisma; migrations in a one-shot `migrate` compose service | decided |

## Key decisions

One line per accepted ADR; rationale lives in the ADR itself.

| # | Decision | ADR |
|---|----------|-----|
| 001 | Guest checkout; the student is the only role that logs in | [001](adr/001-guest-checkout.md) |
| 002 | Course = subject + year range (3 rows); parent picks the year at purchase | [002](adr/002-course-is-subject-with-year-range.md) |
| 003 | Order = list of student seats (year + one course); API takes many, UI sends one | [003](adr/003-order-of-student-seats.md) |
| 004 | Student and enrolment are created when the invitation is redeemed | [004](adr/004-student-created-at-onboarding.md) |
| 005 | Purchase outcome = link + activation code (one secret); the code adds a course to an existing account; one enrolment per course | [005](adr/005-second-purchase-for-existing-student.md) |
| 006 | PostgreSQL + Prisma; migrations and seed run in a separate compose service, never on API start | [006](adr/006-postgresql-prisma-migrations-as-a-step.md) |
| 007 | Student logs in with a unique username; no email required | [007](adr/007-student-logs-in-with-username.md) |
| 008 | JWT in an httpOnly cookie, same-origin `/api`; passwords hashed with `scrypt` | [008](adr/008-jwt-in-httponly-cookie.md) |
| 009 | Activation code: 15 chars `XXXXX-XXXXX-XXXXX`, stored as SHA-256, single use, no expiry | [009](adr/009-activation-code.md) |
| 010 | Mock checkout: one request creates a paid order; payment-gateway interface with a mock; no card fields | [010](adr/010-mock-checkout.md) |
| 011 | npm workspaces: `api/`, `web/`, types-only `packages/contracts/`; compose services `db`, `migrate`, `api`, `web` (nginx + `/api` proxy) | [011](adr/011-repository-and-compose-layout.md) |
| 012 | Backend is a modular monolith on NestJS: `catalogue`, `checkout`, `activation`, `identity`, `lms`; modules talk through public services; no Java service | [012](adr/012-modular-monolith-no-java.md) |
| 013 | API: Jest unit + integration against PostgreSQL via Testcontainers; SPA: Vitest + RTL for behaviour; no browser e2e | [013](adr/013-test-strategy.md) |
| 014 | SPA: Vite, React Router, TanStack Query, Tailwind CSS, React Hook Form | [014](adr/014-frontend-tooling.md) |

Open decisions are tracked in [`STATE.md`](STATE.md).
