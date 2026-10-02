# 006 — PostgreSQL with Prisma; migrations run as a separate step

**Status:** accepted · **Date:** 2026-10-01

## Context
Two rules must hold under concurrency: an activation code is redeemed once, and a student
has one enrolment per course (ADR 005). Creating an account, its enrolment and marking the
code used has to be one atomic operation. `docker compose up` must work from a clean clone.

## Decision
PostgreSQL is the database; Prisma is the data-access layer and migration tool. The rules
above are database constraints and transactions, not application checks.

Migrations and seed data run in a one-shot `migrate` service in Docker Compose — the API
image with a different command. The API starts only after that service has completed
successfully. The API itself never migrates.

## Alternatives considered
- TypeORM — the NestJS-documented integration, close to JPA; no built-in lock around
  migrations and a more fiddly migration-generation setup.
- SQLite — no database container, but further from a real deployment.
- In-memory storage — fastest to write; constraints and transactions would be hand-made
  and data is lost on restart.
- Migrating on API start — one setting, but races as soon as there is a second instance.

## Consequences
- The whole model is one readable schema file; SQL migrations are generated from it and
  committed.
- `migrate deploy` takes a PostgreSQL advisory lock, so concurrent runs are safe as well.
- The image build gains a client-generation step, and Prisma is not NestJS-native: it is
  wrapped in a small injectable service.

## In production
The `migrate` service becomes a job that runs before the rollout (e.g. a Helm pre-upgrade
hook) under a role with schema rights the application role does not have. Migrations are
written to be backward compatible, because old instances keep running during the rollout.

## Notes
- The Context says redeeming a code "has to be one atomic operation". That was later
  replaced: a code is claimed by one conditional update and the rest of the redemption is a
  resumable sequence without a shared transaction (ADR 021, 022). Database constraints —
  unique indexes above all — still carry the rules.
