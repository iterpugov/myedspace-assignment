# 012 — One NestJS backend as a modular monolith; no Java service

**Status:** accepted · **Date:** 2026-10-01

## Context
The brief says MES uses "Java and Node.js for backend services" and asks for technologies
"aligned with this stack"; it lists "how you structure the systems" first among the things
it evaluates. The time box is 3–4 hours, with clarity and pragmatism over completeness.

## Decision
The backend is a single NestJS application, structured as modules along the boundaries of
the journey. Modules talk to each other through their public services and do not reach
into each other's tables.

There is no Java service. The brief describes the MES stack; it requires one of the two
backend technologies, not both.

| Module | Owns |
|---|---|
| `catalogue` | Courses and lessons, read-only |
| `checkout` | Orders, seats, the mock payment gateway |
| `activation` | Activation codes: issuing, hashing, redeeming once |
| `identity` | Students, usernames, passwords, tokens, the auth guard |
| `lms` | Enrolments, dashboard, lesson list, lesson access |

Two ownership calls where a concept is touched by two modules:
- The activation code belongs to `activation`. `checkout` asks it to issue a code for a
  seat; it never handles hashing or redemption itself.
- The enrolment belongs to `lms`, because it answers "what can this student access".
  `activation` calls `lms` to enrol.

## Alternatives considered
- A second service in Java (e.g. the LMS) — a second build system and image, token
  verification in two places, calls between services or a shared database, and no shared
  TypeScript contracts: an hour or more of infrastructure that adds nothing to the journey.
- Four modules, with code redemption inside `identity` — fewer files, but it mixes two
  separate security-critical areas.
- A NestJS application without module boundaries — fastest to write, but shows nothing
  about how the system is structured.

## Consequences
- The seams along which the system could be split are visible in the code.
- Everything deploys together; one database, one transaction where it is needed.
- What crosses the seams is language-neutral: HTTP contracts, a JWT and PostgreSQL.

## In production
Modules could become separate services, in Node.js or Java, once team ownership or load
calls for it. The README describes where those seams are.

## Notes
- "One transaction where it is needed" was available and deliberately not used: writes that
  cross modules run as separate transactions (ADR 021, 022, 027).
