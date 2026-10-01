# 001 — Guest checkout, no parent account

**Status:** accepted · **Date:** 2026-10-01

## Context
The brief has a parent buy access and a student use the LMS. It requires authentication
only for students (LMS-1) and says nothing about the parent returning after the purchase.
The time box is 3–4 hours.

## Decision
Checkout is guest-only. The parent enters their name and email, which are stored on the
order. The student is the only role that logs in.

The student access path (PUR-4) is shown on the order confirmation page, which stands in
for the email a real system would send. It is not written to the API log (amended by
[ADR 020](020-handling-the-activation-code.md)).

## Alternatives considered
- Parent account with login — adds a second role, a second login flow and guards
  (roughly 30–45 minutes) for behaviour the brief does not ask for.

## Consequences
- Auth and access control exist in one place: the student and the LMS.
- The parent cannot come back to view an order or recover a lost invitation link.
- The parent is identified only by the email on the order.

## In production
Parents would have accounts: order history, re-sending invitations, managing several
children, billing. The invitation would be delivered by email rather than shown on screen.
