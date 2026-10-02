# 024 — No signing secret in the repository; `@nestjs/jwt` and `cookie-parser`

**Status:** accepted · **Date:** 2026-10-02

## Context
ADR 008 chose a JWT in an httpOnly cookie and said the signing secret has "a local default
in `.env.example`". `docker compose up` must work from a clean clone with no `.env`, so the
default would have had to live in a committed file — and a committed key signs a valid
session for any student on any instance run with defaults.

## Decision
`JWT_SECRET` is optional. When it is set it must be at least 32 characters, or the API
refuses to start. When it is not set the API generates a random secret at start and logs a
warning. No secret value is committed anywhere.

Tokens are signed and verified with `@nestjs/jwt` 11 (version 12 ships as ES modules only,
which the CommonJS API of ADR 015 cannot load under Jest), pinned to HS256 on both sides; the
cookie is read with `cookie-parser`. The cookie is `HttpOnly`, `SameSite=Strict`,
`Path=/api`, valid for four hours, and `Secure` only when `COOKIE_SECURE=true`, because the
compose stack serves plain http on localhost.

## Alternatives considered
- A default secret in `docker-compose.yml`, like the database password — sessions would
  survive a restart, but a signing key would be public.
- A required variable — strictest, but breaks the clean-clone run.
- `jose` or hand-written HS256 — fewer dependencies, but not the NestJS path, or home-made
  code on the most sensitive path.

## Consequences
- With defaults, every restart of the API signs everyone out, and two API instances would
  not accept each other's tokens.
- Nothing in the repository can forge a session.

## In production
The secret comes from a secret manager and is rotated; `Secure` is always on behind TLS.
