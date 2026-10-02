# 025 — LMS: two guarded endpoints, every read scoped by the student's enrolment

**Status:** accepted · **Date:** 2026-10-02

## Context
The brief asks for a dashboard, a list of lessons and access to a lesson, for authenticated
students only. It says nothing about what a lesson contains. Lessons belong to `catalogue`
and enrolments to `lms` (ADR 012), so every LMS answer combines data of two modules, and
the access rule has to hold for a lesson of a course the student did not buy.

## Decision
The LMS has two endpoints, both behind `SessionGuard` on the controller class:

| Endpoint | Answer |
|---|---|
| `GET /api/lms/courses` | The caller's enrolled courses, each with its lessons in order, without lesson bodies. `[]` when there is no enrolment |
| `GET /api/lms/courses/:courseId/lessons/:lessonId` | One lesson with its body |

The student id comes only from the session token. For a lesson, `lms` first looks up its own
enrolment row for `(student, course)` and only then asks `catalogue` for the lesson by
`(course, lesson)`. A course the student is not enrolled in, an unknown lesson and a lesson
of another course all answer the same **404**. A malformed id answers 400.

`lms` reads course subjects and lessons through `CatalogueService`: separate reads in two
modules, no join across the boundary, although both tables sit in one database.

A lesson is a title, a one-line summary and a plain-text body; three lessons are seeded per
course. Lessons do not differ by year (ADR 002); the enrolment's year is only displayed.

In the SPA the dashboard and the lesson list are one page (`/lms`), and a lesson is
`/lms/courses/:courseId/lessons/:lessonId`. One layout route guards every `/lms` route.

## Alternatives considered
- 403 for "not enrolled", 404 for "unknown" — more precise, but it confirms that a lesson
  exists to someone not entitled to it, and makes the access check a separate branch that
  can be forgotten.
- A separate course page and a lesson-list endpoint — closer to a real LMS, but with one
  course per purchase the dashboard would be a single link; the brief does not ask for it.
- `GET /api/lms/lessons/:lessonId` — shorter URL, but the server would resolve lesson →
  course → enrolment, one hop further from what the client asked for.
- One query joining `Enrolment`, `Course` and `Lesson` — fewer round trips, but `lms`
  would read `catalogue`'s tables directly.
- Markdown or video lessons — a rendering dependency and an HTML-injection surface for
  content the brief does not describe.

## Consequences
- "Enrolled" is part of the lookup, not a check next to it: there is no path that returns a
  lesson by id alone.
- Separate reads are not one snapshot: a subject and its lesson list could come from
  different moments. The catalogue is read-only seed data, so this cannot happen here.
- The guard does not read the database (ADR 008): a token of a deleted student would see an
  empty dashboard. Nothing deletes students in this app.
- The dashboard payload grows with courses × lessons; fine for three courses.

## In production
`lms` and `catalogue` would be separate services: the dashboard would call the catalogue
over the network (with a cache and a fallback), or keep its own read model fed by catalogue
events. Lessons would carry media and per-student progress.
