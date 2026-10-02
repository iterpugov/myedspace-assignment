# 028 — A student holds a course once per year, not once

**Status:** accepted · **Date:** 2026-10-02

## Context
ADR 005 rejected a second code for a course the student already has, and the unique index
in `lms` was `(student, course)`. A course is a subject with a year range (ADR 002), so a
student who moves from Year 9 to Year 10 buys the same course again. That purchase was
refused as a duplicate.

## Decision
A duplicate is the same student, the same course **and the same year**.

- The unique index in `lms` becomes `(student, course, year)`. The index on the seat is
  unchanged: one seat still gives one enrolment.
- The ADR 027 sequence is unchanged; its duplicate check and the release on a late
  duplicate now compare course and year. A code for the same course and year is still
  refused with 409 `course_already_owned` and stays valid for another student.
- The dashboard shows one card per enrolment: "Maths · Year 9" and "Maths · Year 10",
  ordered by subject, then year.
- The lesson URL and the access rule are unchanged: any enrolment of the student for the
  course opens its lessons; anything else is 404 (ADR 025).

## Alternatives considered
- No duplicate rule on the course at all — a parent who pays twice for the same thing would
  silently use up two seats on one child; against ADR 005.
- One card per course listing its years — no repeated lesson list, but it needs grouping
  and a contract change for a presentation detail.
- The year in the lesson URL — a third id to validate, for content that is the same in
  every year.
- Renaming the failure reason — exact, but it changes the contract for no behaviour.

## Consequences
- Both cards of one course list the same lessons, because lessons do not differ by year
  (ADR 002). It looks odd and is the honest result of that model.
- The lesson page shows no year: both cards lead to the same page.
- A claimed, unfinished code for another year of a course the student has is now completed
  instead of released.
- The migration only loosens a constraint, so it cannot fail on existing rows.

## In production
A product per subject and year, with its own lessons, so the two cards would differ. Moving
up a year would be an upgrade of the existing enrolment, not a second purchase.
