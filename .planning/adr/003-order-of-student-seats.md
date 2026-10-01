# 003 — An order is a list of student seats, one course each

**Status:** accepted · **Date:** 2026-10-01

## Context
A parent may buy for more than one child, and children differ in year. The live MyEdSpace
checkout was checked for reference: an order holds "Student 1, Student 2…", each with its
own year, and the students are anonymous at purchase. The time box is 3–4 hours.

## Decision
An order contains one or more student seats. A seat is one year plus one course, and
produces one activation code (PUR-4, ADR 005). The API accepts a list of seats and validates each
course against the seat's year.

The frontend sends exactly one seat: the parent selects a course on the product page, then
picks the student's year from that course's range. Adding further students in the UI is
deferred.

## Alternatives considered
- Order = one student, in the API as well — cheapest, but diverges from the real domain
  and makes multi-child a model change later instead of a UI change.
- Several courses per seat (a basket) — more UI and pricing questions for a flow the
  brief words as "selects a course".
- Seats grouped implicitly by year — cannot tell twins apart.

## Consequences
- The data model matches the real checkout; multi-child is a frontend-only addition.
- Multi-seat orders are exercised by API tests only, not through the UI.
- A second subject for the same child is a second order (see ADR 005).

## In production
The UI would let the parent add students and several subjects per student, with bundle
and sibling pricing.
