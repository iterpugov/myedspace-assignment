# 009 — Activation code: short, stored as a hash, single use, no expiry

**Status:** accepted · **Date:** 2026-10-01

## Context
The activation code is the only link between a paid seat and its student (ADR 004), and it
is a bearer secret: whoever holds it gets the course. It is shown to the parent, copied,
and passed to the child, both as a link and as a code (ADR 005).

## Decision

| Aspect | Choice |
|---|---|
| Shape | 15 characters in three groups, `XXXXX-XXXXX-XXXXX`, like a game-store product key. Alphabet of 32 unambiguous letters and digits: 75 bits from a cryptographic random source |
| Storage | Only the SHA-256 hash of the code. The code itself is returned once, in the purchase response |
| Lifetime | No expiry |
| Single use | Claimed for one student by a conditional update, with a database constraint of one enrolment per seat (amended by [ADR 022](022-redemption-without-a-shared-transaction.md)) |

Input is normalised before hashing: upper-cased, hyphens removed.

## Alternatives considered
- 32 random bytes — more entropy than needed and unpleasant to read out or check by eye.
- Storing the code in plain text — a database leak would expose every unredeemed seat.
- Expiring codes — the seat is paid for and, with guest checkout (ADR 001), nobody could
  have it re-issued.

## Consequences
- Two concurrent redemptions cannot both succeed.
- A lost code cannot be recovered or shown again.
- Guessing is infeasible at 75 bits even without rate limiting.

## In production
Rate limiting on redemption, expiry with re-issue from the parent's account, and delivery
by email.
