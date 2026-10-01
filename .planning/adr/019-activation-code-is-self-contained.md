# 019 — An activation code row carries its own course and year

**Status:** accepted · **Date:** 2026-10-02

## Context
The `activation` module issues a code per order seat in slice 2 and redeems it in slice 3,
when it must know which course and year the code grants. The seat belongs to `checkout`
(ADR 012), and `checkout` already depends on `activation` to issue codes.

## Decision
A code row is a self-contained entitlement: it stores the seat id plus a copy of the
seat's `courseId` and `year`, written when the code is issued. Redemption reads only the
code row.

## Alternatives considered
- Store only the seat id and ask `checkout` for the seat at redemption — no duplicated
  columns, but the two modules would depend on each other.

## Consequences
- `activation` never calls `checkout`; the dependency runs one way.
- Course and year exist in two places. This is safe because a seat never changes:
  correcting the year after purchase is out of scope.

## In production
The same shape: an entitlement that can be redeemed without the ordering system being
available. A change to the seat would revoke the code and issue a new one.
