# 008 — LMS authentication: JWT in an httpOnly cookie

**Status:** accepted · **Date:** 2026-10-01

## Context
Only authenticated students may access the LMS (LMS-1). The brief says no real auth system
is required, so the mechanism should be the smallest one without an obvious hole. The
frontend is a separate SPA.

## Decision
On activation or login the API sets a signed JWT in an httpOnly cookie. A NestJS guard
verifies it on every LMS endpoint. The token lives for a few hours; there are no refresh
tokens. Logout clears the cookie.

The SPA calls the API through the same origin (a `/api` proxy), so the cookie needs no
cross-origin setup.

Passwords are hashed with `scrypt` from Node's standard library, with a per-user salt.

## Alternatives considered
- Server-side sessions in the database — revocable, but a sessions table and a lookup on
  every request.
- JWT in `localStorage` with an `Authorization` header — simplest for a separate SPA, but
  readable by any script on the page.

## Consequences
- The token is not reachable from page scripts; the guard needs no database call.
- A token cannot be revoked before it expires.
- The signing secret comes from the environment; without one the API generates a random
  secret at start (amended by [ADR 024](024-session-secret-and-libraries.md)).

## In production
An identity provider or a dedicated auth service: short-lived access tokens with rotation,
revocation, rate limiting on login, and CSRF protection reviewed for the real domain setup.
