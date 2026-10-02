# 007 — The student logs in with a username

**Status:** accepted · **Date:** 2026-10-01

## Context
Students are in Year 5 to Year 13. A child having no email address of their own is a
normal case, and siblings would otherwise end up sharing a parent's address.

## Decision
The student chooses a username in the onboarding form and logs in with username and
password. Usernames are unique. Email is not required from the student.

If the chosen username is taken, onboarding answers "this account exists, please log in"
and carries the activation code through login (ADR 005).

## Alternatives considered
- Email as the login — familiar and needed for password reset in production, but excludes
  children without an email and collides when siblings use the parent's address.

## Consequences
- Onboarding works for every student in the supported year range.
- There is no channel to reach the student, so no password reset.

## In production
Recovery would go through the parent's account and email. Usernames could be generated or
scoped to the family to avoid "taken" errors.

## Notes
Amended 2026-10-02 (ADR 023, ADR 027): a taken username answers "That username is taken.
Choose another.", and the activation code is not carried through login; a student who
already has an account signs in and pastes the code into "Add a course".
