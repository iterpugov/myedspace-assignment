# 002 — Course is a subject with a year range; the parent picks the year

**Status:** accepted · **Date:** 2026-10-01

## Context
The brief gives three sample courses, each with a subject, a year range and one price
(e.g. Maths, Year 5 → 13, £199). The purchase has to say which year the student is in, and
someone has to choose it.

## Decision
A course is one catalogue row: subject, `yearFrom`, `yearTo`, price — three rows, exactly
as in the brief. The parent picks the year at purchase; it is stored on the student seat
of the order (ADR 003) and validated against the course's range.

Lessons belong to the course (subject), not to a specific year.

## Alternatives considered
- One course per subject and year (25 rows) — allows per-year prices and lessons, but
  multiplies seed data for a difference the demo never shows.
- Student picks the year at onboarding — the order would not record what was bought, and
  range validation would move out of the purchase.

## Consequences
- The catalogue mirrors the provided data one to one (CAT-1, CAT-2).
- The onboarding form collects the student's own details, not purchase details.
- Price and lesson content cannot differ between years of the same subject.

## In production
Each subject and year would be its own product with its own price, timetable and content,
likely with tiers and bundles on top.
