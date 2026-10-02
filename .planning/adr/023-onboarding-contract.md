# 023 — Onboarding: one form, one request, distinct answers for a bad and a used code

**Status:** accepted · **Date:** 2026-10-02

## Context
The brief asks for "a basic onboarding form" reached from the purchase outcome. The form's
content, when the code is checked, and what a student is told about a code that does not
work were all open.

## Decision

| Aspect | Choice |
|---|---|
| Form | Activation code (prefilled from the link, editable), first name, username, password, and a repeat-password field that never leaves the browser |
| When the code is checked | Only on submit: `POST /api/activations` does everything |
| Unknown code | 422 with `reason: code_invalid` — "check the code" |
| Used code | 409 with `reason: code_used` — "already used, sign in" |
| Taken username | 409 with `reason: username_taken`, shown under the field; the code stays valid |
| Username | 3–20 characters of `a–z`, `0–9`, `_`; lower-cased, so uniqueness ignores case |
| Password | 8–128 characters, no composition rules |
| After success | The student is signed in and taken to the LMS |

The page reads the code from the URL fragment once and then removes the fragment from the
address (ADR 020).

## Alternatives considered
- A separate "check this code" endpoint — the page could name the course before the form
  is filled in, at the cost of a second anonymous endpoint and a two-step page.
- One answer for unknown and used codes — reveals nothing, but a student who reuses their
  own link gets no hint to sign in. Telling them apart helps only someone who already
  holds the code.
- Collecting more about the student — personal data about a child that nothing uses.

## Consequences
- One endpoint and one page; a used link is discovered only after the form is filled in.
- Registration reveals whether a username exists, as any username registration does.
- The first name is the only personal detail stored about the student.

## In production
The code would be checked when the link opens, and a parent would confirm the child's
details.
