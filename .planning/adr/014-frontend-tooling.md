# 014 — Frontend tooling

**Status:** accepted · **Date:** 2026-10-01

## Context
The SPA has about six screens: product page, checkout, confirmation, activation, login and
the LMS. It needs routing with protected routes, a handful of API calls and three short
forms. There are no design files.

## Decision

| Part | Choice |
|---|---|
| Build | Vite |
| Routing | React Router |
| API calls | TanStack Query |
| Styling | Tailwind CSS |
| Forms | React Hook Form |

## Alternatives considered
- Hand-written hooks over `fetch` — one dependency fewer, but loading, error and
  "who am I" state would be re-implemented on every screen.
- Plain CSS — no setup, slower to reach a tidy result; a component library — heavier than
  six screens need.
- Plain controlled inputs — no dependency, but validation and error display are written by
  hand in each form.

## Consequences
- Server state, including the current student, lives in one cache with uniform loading and
  error handling.
- Form validation and error messages follow one pattern across checkout, activation and
  login.

## In production
The same choices would hold; a shared design system would replace ad-hoc Tailwind classes.
