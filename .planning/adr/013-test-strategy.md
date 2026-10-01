# 013 — Test strategy: Jest and Testcontainers for the API, Vitest for the SPA

**Status:** accepted · **Date:** 2026-10-01

## Context
The rules that matter most — a code is redeemed once, one enrolment per course — are
database constraints and transactions (ADR 006), so tests with a mocked database would not
exercise them. The time box rules out a broad test pyramid.

## Decision

| Level | Tool | Covers |
|---|---|---|
| API unit | Jest | Pure logic: activation code generation and normalisation, year against course range, password hashing |
| API integration | Jest + Testcontainers | HTTP requests against the application with a real PostgreSQL started for the test run |
| SPA behaviour | Vitest + React Testing Library | LMS route protection and the branches of the activation page |
| Browser end-to-end | none | The full journey is checked by hand and described in the README |

Presentational UI is not covered by tests.

## Alternatives considered
- Integration tests against the `db` service from Docker Compose — fewer dependencies, but
  tests depend on a database someone started and can leave state behind.
- Mocking the data layer — fast, but blind to the constraints the design relies on.
- Browser end-to-end tests — the most expensive level for one linear journey.

## Consequences
- Every test run gets a clean, disposable database with the real migrations applied.
- Running the API tests needs Docker on the machine, and the first run pulls an image.

## In production
The same levels, plus a small browser end-to-end suite for the purchase-to-LMS journey and
contract tests between services.
