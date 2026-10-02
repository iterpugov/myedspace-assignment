# 026 — Login gives one answer for every failure; logout only clears the cookie

**Status:** accepted · **Date:** 2026-10-02

## Context
Slice 3 signs a student in only at onboarding. A returning student needs to sign in with
username and password (ADR 007) and to sign out. A login endpoint that answers differently
for "no such username" and "wrong password" tells an attacker which usernames exist.

## Decision
| Endpoint | Answer |
|---|---|
| `POST /api/session` `{ username, password }` | 200 with the student and the session cookie of ADR 024 |
| the same, with credentials that do not match | 401 `Invalid username or password`, no cookie |
| `DELETE /api/session` | 204 and a `Set-Cookie` that expires the cookie; needs no session |

- An unknown username and a wrong password give the same status and the same body. For an
  unknown username the API still runs one scrypt verification, against a dummy hash made
  from random bytes when the API starts, so both failures cost about the same time.
- Login validation is lenient: the username is trimmed and lower-cased, 1–64 characters;
  the password is 1–128 characters and is not trimmed. A username that could never have
  been registered is a 401, not a 400. 400 is only for a malformed body.
- A failed login is logged without the typed username, which may be a password typed into
  the wrong field. The password is never logged.
- Logout clears the cookie in the browser. It does not revoke the token (ADR 008).
- The API refuses any request body that is not JSON with 415. A form on another site can
  post urlencoded, multipart or plain text without a preflight, but not JSON, so it cannot
  sign a browser into someone else's account. This applies to every endpoint.
- The SPA clears its query cache at sign-out and always lands on `/lms` after sign-in; no
  redirect target is taken from the URL.

## Alternatives considered
- Distinct answers for unknown username and wrong password — friendlier, but enumerates
  accounts.
- Skipping the hash for an unknown username — the response time would reveal the same.
- The registration rules (pattern, 8-character minimum) at login — a 400 with field
  messages would again tell which inputs could be real usernames.
- Logout behind the session guard — an expired session could then not be cleared.
- A server-side session list for revocation — needs a store read on every request, which
  ADR 008 chose not to have.

## Consequences
- The timing equality is approximate: the database lookup and a hash stored with other
  parameters still differ slightly.
- Onboarding still answers `username_taken` (ADR 023), so usernames can be probed there,
  but only with a valid unused activation code.
- Login is an anonymous endpoint that costs one scrypt run per attempt; with rate limiting
  out of scope, a flood slows the API.
- A copied token stays valid until it expires, at most four hours.

## In production
Rate limiting and lockout per account and per address, a breached-password check, and
short-lived access tokens with a revocable refresh token.
