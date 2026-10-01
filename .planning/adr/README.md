# ADR register

Architecture decisions for the take-home. An ADR is written only after the user has made
the decision; it records the call, it does not make it.

## Register

| # | Title | Status | Date |
|---|-------|--------|------|
| 001 | [Guest checkout, no parent account](001-guest-checkout.md) | accepted | 2026-10-01 |
| 002 | [Course is a subject with a year range; the parent picks the year](002-course-is-subject-with-year-range.md) | accepted | 2026-10-01 |
| 003 | [An order is a list of student seats, one course each](003-order-of-student-seats.md) | accepted | 2026-10-01 |
| 004 | [The student record is created at onboarding](004-student-created-at-onboarding.md) | accepted | 2026-10-01 |
| 005 | [An activation code adds a course to an existing student account](005-second-purchase-for-existing-student.md) | accepted | 2026-10-01 |
| 006 | [PostgreSQL with Prisma; migrations run as a separate step](006-postgresql-prisma-migrations-as-a-step.md) | accepted | 2026-10-01 |
| 007 | [The student logs in with a username](007-student-logs-in-with-username.md) | accepted | 2026-10-01 |
| 008 | [LMS authentication: JWT in an httpOnly cookie](008-jwt-in-httponly-cookie.md) | accepted | 2026-10-01 |
| 009 | [Activation code: short, stored as a hash, single use, no expiry](009-activation-code.md) | accepted | 2026-10-01 |
| 010 | [Mock checkout: one request, always approved, no card fields](010-mock-checkout.md) | accepted | 2026-10-01 |
| 011 | [Workspaces with a types-only contracts package, four compose services, one origin](011-repository-and-compose-layout.md) | accepted | 2026-10-01 |
| 012 | [One NestJS backend as a modular monolith; no Java service](012-modular-monolith-no-java.md) | accepted | 2026-10-01 |
| 013 | [Test strategy: Jest and Testcontainers for the API, Vitest for the SPA](013-test-strategy.md) | accepted | 2026-10-01 |
| 014 | [Frontend tooling](014-frontend-tooling.md) | accepted | 2026-10-01 |
| 015 | [Toolchain versions are pinned to the last proven majors](015-toolchain-versions.md) | accepted | 2026-10-01 |
| 016 | [The SPA follows the MyEdSpace visual language, described as a design system](016-mes-visual-language.md) | accepted | 2026-10-02 |
| 017 | [Catalogue contract: UUID course ids, price in pence, selection in the URL](017-catalogue-contract.md) | accepted | 2026-10-02 |
| 018 | [Requests are validated with class-validator and a global ValidationPipe](018-request-validation.md) | accepted | 2026-10-02 |
| 019 | [An activation code row carries its own course and year](019-activation-code-is-self-contained.md) | accepted | 2026-10-02 |
| 020 | [The plain activation code lives only in the response and the browser tab](020-handling-the-activation-code.md) | accepted | 2026-10-02 |
| 021 | [Activation codes are issued before the order is saved, in separate transactions](021-codes-issued-before-the-order.md) | accepted | 2026-10-02 |

## Format

File name: `NNN-kebab-title.md`. Keep it short — these are read by assignment reviewers.

```markdown
# NNN — Title

**Status:** accepted · **Date:** YYYY-MM-DD

## Context
What forces the decision. 2–4 sentences.

## Decision
What we do.

## Alternatives considered
- Option — why not.

## Consequences
What this makes easy, what it makes hard.

## In production
What a real system would do differently, and why it is out of scope here.
```
