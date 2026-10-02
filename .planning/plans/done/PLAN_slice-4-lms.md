# PLAN — Slice 4 «LMS»

> **Done.** Produced by the `planner` subagent on 2026-10-02. Section 2 lists the decisions the user
> has to make before `tdd-guide` starts; sections 3–9 assume the recommendations and must be
> adjusted if the user chooses otherwise.

Slice 4 turns the `/lms` placeholder into the LMS: a student signs in with username and
password, sees their courses with the lessons of each, opens a lesson, and signs out. On the
API it adds login and logout to `identity`, a `Lesson` table and seed to `catalogue`, and
the first guarded, enrolment-scoped endpoints in `lms`. The central question is access
control: every LMS query is keyed by the student id from the session and by an enrolment
row, never by anything the client sends.

Not trivial; the planner is not skipped. The roadmap gives this slice 35 minutes; with
three decisions, about 45 tests and two reviews it will realistically take longer (see Risks).

## 1. Goal and done criteria

**Goal:** a student signs in at `/login`, sees only the courses they are enrolled in with
their lessons, opens a lesson, and signs out; nothing in the LMS is reachable without a
session or outside the student's enrolments.

**Requirements covered:** LMS-1, LMS-2, LMS-3, LMS-4 (and it makes TEC-3 walkable end to end).

| # | Criterion | Check |
|---|-----------|-------|
| 1 | Login works | `POST /api/session` with the right credentials returns the student and sets `mes_session` with the ADR 024 attributes |
| 2 | Login reveals nothing | Unknown username and wrong password give the same status, the same body and no cookie; both run one scrypt verification |
| 3 | Logout clears the cookie | `DELETE /api/session` answers 204 with a `Set-Cookie` that expires `mes_session` on `Path=/api` |
| 4 | LMS endpoints need a session | Every `/api/lms/*` route answers 401 without a valid cookie (LMS-1) |
| 5 | Dashboard is scoped | `GET /api/lms/courses` returns only the caller's enrolled courses, each with its lessons in order; a student with no enrolment gets `[]` (ADR 022) |
| 6 | A lesson opens only with an enrolment | The lesson endpoint returns the body for an enrolled student; for a course the student is not enrolled in it does not (roadmap done criterion; status per D1) |
| 7 | Ids cannot be mixed | A lesson id of course X requested under course Y's id does not open, even when the student is enrolled in Y |
| 8 | Lessons are seeded | `migrate` applies five migrations and seeds lessons for all three courses; the seed is idempotent |
| 9 | Web is guarded | `/lms` and the lesson page redirect to `/login` without a session; `/login` signs in and lands on `/lms` |
| 10 | Empty state | A student with no courses sees a message, not an error |
| 11 | Sign out | The LMS header has "Sign out"; after it `/lms` redirects to `/login` and the query cache holds no lesson |
| 12 | Tests | `npm test -w api`, `npm run test:int -w api`, `npm test -w web` pass |
| 13 | Clean clone | `docker compose down -v && docker compose up --build -d --wait` exits 0 with no `.env` |
| 14 | Reviews | `typescript-reviewer`, `code-reviewer`; `security-reviewer` ends in PASS |

**Out of scope** (new entries go to `ROADMAP.md` "Out of scope" when closing):
- Lesson progress, completion marks, "continue where you left off". Production: per-student progress records.
- Video, markdown or rich lesson content (if D3-A is chosen). Production: a content service with media.
- Returning to the originally requested page after login; the student always lands on `/lms`.
- Revoking a token at logout: the cookie is cleared, a copied token stays valid until it expires (ADR 008, already accepted).
- Login throttling and lockout (covered by the existing "Rate limiting" entry; extend its text to name login).
- Adding a code to an existing account and carrying a code through login (slice 5). The ADR 005 / ADR 023 wording item stays in `STATE.md`.
- CSRF tokens (already recorded), password reset (already recorded).

## 2. Decisions needed

> **Decisions made (user, 2026-10-02):** D1-A (404), D2-A (two levels), D3-A (plain text,
> three lessons per course); M1–M23 accepted as proposed. Recorded in ADR 025 and ADR 026.
> Before deciding, the user checked the brief: lessons are required (LMS-3, LMS-4), so the
> lesson page stays; a separate course page is not required and is not built.

### Already decided — the plan follows these, no call needed

| Question | Answer | Source |
|---|---|---|
| Which module owns lessons | `catalogue` owns "courses and lessons, read-only"; `lms` owns "enrolments, dashboard, lesson list, lesson access" | ADR 012 |
| Do lessons differ per year | No: "lessons belong to the course (subject), not to a specific year". The enrolment's year is shown, never used to filter | ADR 002 |
| How `lms` gets course titles and lessons | Through `CatalogueService` only: `lms` reads its own `Enrolment` rows, then asks `catalogue` by course id. Two queries, no join across the module boundary, even though the Prisma relation `Enrolment.course` exists | ADR 012, ADR 021/022 discipline |
| Session mechanism, cookie attributes, lifetime | JWT HS256 in `mes_session`, 4 h, guard without a database read | ADR 008, ADR 024 |
| Status-code convention | 400 shape, 422 business rule | ADR 018 |

If the user wants lessons moved into `lms` instead, that is an amendment to ADR 012 and
changes tasks 2 and 4; say so before step 2.

### Needs the user's call before code

**D1 — What a student gets for a course or lesson they are not enrolled in: 404 or 403.**

| Option | Trade-off |
|---|---|
| A. 404, identical to "no such lesson" | Reveals nothing: a student cannot tell an existing lesson of another course from a made-up id. One answer, one web message. Slightly less helpful for debugging |
| B. 403 for not enrolled, 404 for unknown | Semantically precise and lets the UI say "you do not have this course". Confirms that a course or lesson id exists to someone who is not entitled to it; two branches to test |

Recommendation: **A**. The ids are UUIDs so the leak in B is small, but A makes "enrolled"
part of the lookup itself rather than a separate check that can be forgotten.

**D2 — Shape of the LMS: two levels or three.**

| Option | API | Pages | Trade-off |
|---|---|---|---|
| A. Compact | `GET /api/lms/courses` (enrolled courses, each with its lesson list, no bodies); `GET /api/lms/courses/:courseId/lessons/:lessonId` | `/lms` (dashboard with a card per course listing its lessons); `/lms/courses/:courseId/lessons/:lessonId` | Two guarded endpoints, two pages, least code and tests. The dashboard and the lesson list are one screen; payload grows with courses (at most 3 courses × a few lessons here) |
| B. Three levels | A plus `GET /api/lms/courses/:courseId/lessons`; the dashboard returns courses only | `/lms`, `/lms/courses/:courseId`, lesson page | LMS-2 and LMS-3 map to separate screens, closer to a real LMS. A third guarded endpoint and page, about 8 more tests, and with one course per purchase the dashboard is a single link |
| C. Flat lesson URL | `GET /api/lms/lessons/:lessonId` | lesson page without the course in the URL | Shorter URLs, but the server must resolve lesson → course → enrolment; the access check is one hop further from the URL |

Recommendation: **A**. In both A and B the course id is in the lesson URL, so the lesson
query is literally "this student, this course, this lesson". Not C.

**D3 — Lesson content and seed size.**

| Option | Trade-off |
|---|---|
| A. `title`, one-line `summary`, plain-text `body` (paragraphs separated by blank lines); 3 lessons per course, 9 in total | No dependency, nothing to sanitise (React escapes text). Looks plain |
| B. A plus a `videoUrl` placeholder rendered as a non-playing frame | Looks more like MES. A field that leads nowhere; an embedded third-party URL would need a CSP thought |
| C. Markdown body | Richer lessons. A rendering dependency and an HTML-injection surface to review |

Recommendation: **A**.

### Proposed defaults — confirm or change

| # | Detail | Default | Why |
|---|---|---|---|
| M1 | Login endpoint | `POST /api/session`, body `{ username, password }`, **200** with `StudentResponse` and the cookie; `Cache-Control: no-store` | Same resource as `GET /api/session`; same response type as activation |
| M2 | Login failure | **401**, fixed body `{ statusCode: 401, message: 'Invalid username or password' }`, no `reason`, no cookie — byte-identical for unknown username and wrong password | Carried from the slice 3 review |
| M3 | Login timing | When the username is unknown, `verifyPassword` still runs once against a dummy hash, so both failures cost one scrypt. The dummy is a real hash of random bytes made with the current parameters when the API starts (nothing committed). The slice 3 test fixture `scrypt$…$dGVzdA==$dGVzdA==` must NOT be used: its key length fails the early check and returns without hashing | Removes the obvious timing oracle |
| M4 | Login DTO | Lenient: `username` string, normalised (trim, lower-case), 1–64 characters; `password` string, 1–128 characters, not trimmed. No username pattern and no 8-character minimum at login: anything that cannot match is a 401, not a 400. The 128 cap bounds scrypt input. Unknown properties are 400 (global pipe) | One failure message for the student; 400 only for a genuinely malformed body |
| M5 | Login while signed in | Allowed; the cookie is replaced | No special case |
| M6 | Logout | `DELETE /api/session`, **204**, not behind `SessionGuard`, always clears the cookie (same `path` and attributes as when set) | Idempotent; an expired session can still be cleared |
| M7 | Ownership of login | `IdentityService.authenticate(username, password)` returns the student or `undefined`; `SessionController` maps `undefined` to 401 and calls `SessionService.start`. `SessionService.end(response)` clears the cookie | Keeps the public service transport-neutral (slice 3 M20) |
| M8 | Login logging | Success: "Student <id> signed in". Failure: a line without the typed username (it may be a password typed in the wrong field) and never the password | ADR 020 spirit |
| M9 | LMS routes | Controller `lms` with `@UseGuards(SessionGuard)` on the class, not per method; student id only from `@CurrentStudentId()` | A new route cannot be added unguarded by omission |
| M10 | Id parameters | `ParseUUIDPipe` on `courseId` and `lessonId`: malformed is 400. Guards run before pipes, so without a session it is still 401 | Without it a non-UUID reaches Prisma and becomes a 500 |
| M11 | Order of checks for a lesson | `lms` checks the enrolment (its own table) first, then asks `catalogue` for the lesson by `(courseId, lessonId)`; both misses throw the same exception | No catalogue read for a course the student does not have |
| M12 | Deleted student with a live token | LMS routes do not re-read the student (the guard stays stateless, ADR 008): such a token sees an empty dashboard. `GET /api/session` still answers 401, and the SPA guards on that | Nothing deletes students in this app |
| M13 | Caching | `Cache-Control: no-store` on login, logout and both LMS responses | Slice 3 M16 |
| M14 | Lesson table | `Lesson { id uuid, courseId → Course, position, title, summary, body }`, unique `(courseId, position)`; foreign key to `Course` is inside one module | The seed upserts on `(courseId, position)` |
| M15 | Seed entry point | `seedCourses(prisma)` keeps its name and also upserts each course's lessons; `CourseSeed` gains `lessons` | Five test files call it in `beforeEach`; no churn |
| M16 | Dashboard order | Courses by subject, lessons by position | Deterministic for tests |
| M17 | Web guard | One layout route (`RequireSession`) around every `/lms` route: asks `GET /api/session`; `null` → `/login`; error → notice; loading → notice. Pages inside do not repeat the check | One place to get wrong instead of two |
| M18 | Header | Public pages keep "Courses" and "Sign in" and make no session request. The LMS layout passes its own navigation ("My courses", "Sign out") to the header. `/login` asks for the session once and sends a signed-in student to `/lms` | A header that fetched the session everywhere would fire a 401 on the parent's product page and break existing page tests that reject unexpected requests |
| M19 | Session expiry mid-use | A 401 from an LMS request invalidates the `['session']` query; the guard then redirects to `/login` | 4-hour tokens do expire while a tab is open |
| M20 | Sign out in the SPA | `DELETE /api/session`, then clear the whole query cache and go to `/login` | No lesson content left in memory for the next user of the browser |
| M21 | After login | Always `/lms`, with `replace`; login mutation uses `gcTime: 0` | No open redirect to think about; the password does not stay in the cache |
| M22 | Lesson body rendering | Split on blank lines into paragraphs as text; never `dangerouslySetInnerHTML` | D3-A |
| M23 | Not-available lesson in the SPA | "This lesson is not available." with a link back to `/lms`, for 404 (and 400) | One message, matches D1-A |

## 3. Design

Assumes D1-A, D2-A, D3-A and M1–M23.

### Prisma (one migration, `add_lesson`)

```prisma
/// Owned by the catalogue module (ADR 012). Belongs to a course, not to a year (ADR 002).
model Lesson {
  id       String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  courseId String @db.Uuid
  course   Course @relation(fields: [courseId], references: [id])
  /// 1-based order within the course; the seed upserts on (courseId, position).
  position Int
  title    String
  summary  String
  body     String

  @@unique([courseId, position])
}
```
`Course` gains `lessons Lesson[]`.

### Contract (`packages/contracts/src/index.ts`)

```ts
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LessonSummaryResponse {
  id: string;
  position: number;
  title: string;
  summary: string;
}

/** A course the signed-in student is enrolled in, with its lessons in order. */
export interface EnrolledCourseResponse {
  courseId: string;
  subject: string;
  /** The year bought for this student; lessons do not differ by year (ADR 002). */
  year: number;
  lessons: LessonSummaryResponse[];
}

export interface LessonResponse extends LessonSummaryResponse {
  courseId: string;
  subject: string;
  body: string;
}
```

### Endpoints

| Method and path | Guard | Success | Failures |
|---|---|---|---|
| `POST /api/session` | none | 200 `StudentResponse` + `Set-Cookie` | 400 shape; 401 bad credentials (M2) |
| `DELETE /api/session` | none | 204 + clearing `Set-Cookie` | — |
| `GET /api/session` | `SessionGuard` | unchanged | unchanged |
| `GET /api/lms/courses` | `SessionGuard` | 200 `EnrolledCourseResponse[]` (may be `[]`) | 401 |
| `GET /api/lms/courses/:courseId/lessons/:lessonId` | `SessionGuard` | 200 `LessonResponse` | 401; 400 malformed id; 404 not enrolled, unknown lesson, or lesson of another course (D1) |

### Module surfaces and dependencies

| Module | Change |
|---|---|
| `catalogue` | `CatalogueService.listLessonSummaries(courseIds)` → summaries with `courseId`, ordered by position; `CatalogueService.findLesson(courseId, lessonId)` → lesson with body, or `undefined`. `findCoursesByIds` already exists |
| `identity` | `IdentityService.authenticate(username, password)`; `SessionService.end(response)`; `SessionController` gains `POST` and `DELETE`; `LoginRequestDto`; a dummy-hash helper next to `verifyPassword` |
| `lms` | `EnrolmentService.listForStudent(studentId)` and `findForCourse(studentId, courseId)`; new `LearningService` (`listCourses(studentId)`, `openLesson(studentId, courseId, lessonId)`) that combines enrolments with `CatalogueService`; new `LmsController`. `LmsModule` imports `IdentityModule` (for `SessionService`, which the guard needs) and `CatalogueModule` |

Dependency direction stays acyclic: `activation → {identity, lms}`, `lms → {identity, catalogue}`,
`checkout → {catalogue, activation}`. `AppModule` lists `LmsModule` explicitly now that it
has a controller.

A code comment on `LearningService` states the trade-off: two reads in two modules instead
of one join; the result can be momentarily inconsistent if the catalogue changes between
them, which is harmless for read-only seed data and is what a split into services would
look like.

### Web

| Route | Element | Behaviour |
|---|---|---|
| `/login` | `LoginPage` | Username and password (React Hook Form); 401 → "The username or password is not right."; other failures → generic notice; success → `/lms`. Already signed in → `/lms` |
| `/lms` (layout) | `RequireSession` | M17; renders `PageShell` with the LMS navigation and "Sign out" |
| `/lms` (index) | `LmsPage` | "Welcome, <first name>"; one `Card` per course ("Maths · Year 7") with its lessons as links; no courses → notice "You have no courses yet. Ask your parent for an activation link." |
| `/lms/courses/:courseId/lessons/:lessonId` | `LessonPage` | Subject, "Lesson n", title, body paragraphs, "← Back to my courses"; 404 → M23 |

## 4. File scope

```
packages/contracts/src/index.ts                    add LoginRequest, LessonSummaryResponse, EnrolledCourseResponse, LessonResponse

api/prisma/schema.prisma                           Lesson; Course.lessons
api/prisma/migrations/<ts>_add_lesson/migration.sql
api/src/seed/data/course-seed.ts                   CourseSeed.lessons
api/src/seed/data/{english,maths,science}.ts       3 lessons each
api/src/seed/index.ts                              upsert lessons per course
api/src/seed/run.ts                                log line counts lessons too

api/src/catalogue/catalogue.service.ts             listLessonSummaries, findLesson
api/src/catalogue/catalogue.int.spec.ts            lesson seed and service tests

api/src/identity/password.ts (+ spec)              dummy-hash helper
api/src/identity/identity.service.ts               authenticate
api/src/identity/identity.service.spec.ts          new (unit, verify is always called)
api/src/identity/dto/login-request.dto.ts          new
api/src/identity/session.service.ts                end(); cookie options shared by start and end
api/src/identity/session.controller.ts             POST, DELETE
api/src/identity/session.int.spec.ts               login and logout tests

api/src/lms/enrolment.service.ts                   listForStudent, findForCourse
api/src/lms/learning.service.ts                    new
api/src/lms/lms.controller.ts                      new
api/src/lms/lms.module.ts                          imports, controller, provider
api/src/lms/lms.int.spec.ts                        new
api/src/app.module.ts                              LmsModule listed

web/src/App.tsx                                    /login, nested /lms routes
web/src/api/session.ts                             login(), logout(), LoginError
web/src/api/lms.ts                                 new: fetchMyCourses(), fetchLesson(), LmsError
web/src/RequireSession.tsx (+ test)                new layout route
web/src/pages/LoginPage.tsx (+ test)               new
web/src/pages/LmsPage.tsx (+ test)                 dashboard; existing test rewritten
web/src/pages/LessonPage.tsx (+ test)              new
web/src/pages/ActivatePage.test.tsx                stub GET /api/lms/courses where the test lands on /lms
web/src/ui/Header.tsx, web/src/ui/PageShell.tsx    optional navigation passed in by the LMS layout
web/DESIGN_SYSTEM.md                               Header signed-in state; build-status line
```

No change to `docker-compose.yml`, `.env.example`, `nginx.conf` or dependencies.

## 5. Tests for `tdd-guide` (RED before code)

Security cases are marked **[S]**.

### API unit — `api/src/identity/password.spec.ts` (additions)
1. **[S]** The dummy hash has the stored-hash format with the current parameters and a 64-byte key (so `verifyPassword` cannot return early on it).
2. **[S]** `verifyPassword(<anything>, dummy)` is false.

### API unit — `api/src/identity/identity.service.spec.ts` (new; Prisma faked, `./password` wrapped with `jest.mock` keeping the real functions)
3. **[S]** `authenticate` for an unknown username returns `undefined` and calls `verifyPassword` exactly once, with the dummy hash.
4. `authenticate` for a known username calls `verifyPassword` exactly once with the stored hash.
5. **[S]** The returned student has exactly `id`, `username`, `firstName` — no `passwordHash`.

### API integration — `api/src/identity/session.int.spec.ts` (additions; helper `onboard()` already exists)
6. `POST /api/session` with the right credentials: 200, body equals the student, `Cache-Control: no-store`.
7. **[S]** The login cookie is `mes_session` with `HttpOnly`, `SameSite=Strict`, `Path=/api`, `Max-Age` 14400 and no `Secure` by default.
8. The login cookie authenticates `GET /api/session` and `GET /api/lms/courses`.
9. **[S]** Wrong password: 401, no `Set-Cookie`.
10. **[S]** Unknown username: 401, no `Set-Cookie`, and the body is deep-equal to the body of test 9.
11. The username is accepted in another case and with surrounding spaces.
12. **[S]** The password is not trimmed or case-folded: the right password plus a trailing space, and in another case, are 401.
13. **[S]** Two students: logging in as B returns B and a token whose `sub` is B, never A.
14. **[S]** Table-driven 400s, none setting a cookie: missing `username`, missing `password`, empty strings, a non-string `username` (array, object, number), a 129-character password, a 65-character username.
15. **[S]** Extra properties (`studentId`, `id`, `firstName`) are 400.
16. **[S]** Neither a 401 nor a 200 body contains `passwordHash` or the password sent.
17. `DELETE /api/session` with a cookie: 204, empty body, and a `Set-Cookie` for `mes_session` with `Path=/api` and an expiry in the past.
18. `DELETE /api/session` without a cookie: 204 as well.

### API integration — `api/src/catalogue/catalogue.int.spec.ts` (additions)
19. After `seedCourses`, every course has at least one lesson, positions start at 1 and are contiguous.
20. Running `seedCourses` twice leaves the same number of lessons and the same lesson ids.
21. `listLessonSummaries([maths])` returns Maths lessons in position order, without `body`; an empty id list returns `[]`.
22. `findLesson(mathsId, mathsLessonId)` returns the lesson with its body; `findLesson(englishId, mathsLessonId)` and an unknown lesson id return `undefined`.
23. **[S]** `GET /api/courses` (public) still returns exactly the five course fields — no lessons leak into the public catalogue.

### API integration — `api/src/lms/lms.int.spec.ts` (new)
`beforeEach`: reset, seed. Helpers: `onboard(username, subject, year)` through the real purchase and activation endpoints, returning the student and cookie; `studentWithoutCourse()` created directly plus a token signed by the app.

24. **[S]** Without a cookie, both LMS routes are 401 (table over the routes).
25. **[S]** With a garbage cookie, an expired token and a token signed with another secret, both routes are 401.
26. **[S]** Without a cookie and with a malformed id, the lesson route is 401, not 400.
27. Dashboard for a Maths / Year 7 student: 200, one entry with `subject: 'Maths'`, `year: 7`, lessons in position order, each with exactly `id`, `position`, `title`, `summary`; `Cache-Control: no-store`.
28. **[S]** A lesson summary in the dashboard has no `body`.
29. **[S]** Student A (Maths) and student B (English): each dashboard shows only their own course.
30. A student with two enrolments (second created through `EnrolmentService`) sees two entries ordered by subject.
31. A student with no enrolment gets 200 `[]` (ADR 022).
32. **[S]** `GET /api/lms/courses?studentId=<A>` with B's cookie returns B's courses.
33. An enrolled student opens a lesson: 200 with `id`, `courseId`, `subject`, `position`, `title`, `summary`, `body`.
34. **[S]** B (English only) requests a Maths lesson under the Maths course id: 404 (D1), and the response contains neither the lesson title nor its body.
35. **[S]** The body of test 34 is deep-equal to the 404 for a random, non-existent lesson id under a course B is enrolled in.
36. **[S]** B requests a Maths lesson id under the English course id (enrolled in English): 404.
37. **[S]** A student with no enrolment requesting any real lesson: 404.
38. A random course id and a random lesson id: 404.
39. Malformed `courseId` or `lessonId` with a valid session: 400.
40. **[S]** After B's 404s, A (enrolled) still gets 200 for the same lesson — control that the 404s were about access, not a broken route.

### Web — `web/src/RequireSession.test.tsx`
41. `GET /api/session` 401 redirects to `/login` and renders no child content.
42. 200 renders the child route and the LMS navigation with "Sign out".
43. While the session answer is pending, "Loading…" is shown and the child is not.
44. "Sign out" sends `DELETE /api/session`, then shows the login route; a following visit to `/lms` asks for the session again.

### Web — `web/src/pages/LoginPage.test.tsx`
45. An empty submit shows a required error under each field and sends no request.
46. A valid submit sends `POST /api/session` with a trimmed, lower-cased `username` and the `password` untouched, and nothing else.
47. After 200 the student is on `/lms`.
48. 401 shows one alert that names neither field; the username is kept; the button is enabled again.
49. A 500 shows the generic alert.
50. The button is disabled while the request is pending.
51. A student who is already signed in is sent to `/lms`.

### Web — `web/src/pages/LmsPage.test.tsx` (rewritten)
52. Shows "Welcome, <first name>" and a card "Maths · Year 7" whose lessons are links to `/lms/courses/<courseId>/lessons/<lessonId>`.
53. An empty course list shows the "no courses yet" notice and no error.
54. A failed courses request shows an error notice.
55. A 401 from the courses request ends on `/login` (M19).

### Web — `web/src/pages/LessonPage.test.tsx`
56. Shows the subject, the title and each paragraph of the body; requests the URL built from both route parameters.
57. A body containing `<script>` or HTML is shown as text.
58. A 404 shows "This lesson is not available." and a link to `/lms`.
59. A 401 ends on `/login`.

`web/src/pages/ActivatePage.test.tsx` test 48 of slice 3 (lands on `/lms` and sees the
welcome) needs its API stub extended with `GET /api/lms/courses`; this is an edit, not a new test.

## 6. Ordered tasks

| # | Task | Files | Acceptance | Pipeline |
|---|---|---|---|---|
| 1 | User decides D1–D3 and confirms M1–M23; record ADRs, `PROJECT.md`, `STATE.md`; save this plan | `.planning/**` | ADRs accepted; section 2 gets a "Decisions made" block | — |
| 2 | Contract types; `Lesson` model and migration; lesson seed data; `seedCourses` upserts lessons | contracts, `schema.prisma`, migration, `api/src/seed/**` | `prisma migrate deploy` applies five migrations on an empty database; seed twice gives the same rows; existing suites still green | simplified (seed data, schema), reviewed in step 8 |
| 3 | RED: tests 1–40 | spec files in section 4 | The runner shows them failing for the right reason (missing route or method, not a compile error elsewhere) | `tdd-guide` |
| 4 | GREEN, in this order: `catalogue` lesson reads (19–23) → `identity` login and logout (1–18) → `lms` enrolment reads, `LearningService`, `LmsController`, module wiring (24–40); refactor | `api/src/catalogue`, `identity`, `lms`, `app.module.ts` | Criteria 1–8; `npm test -w api` and `npm run test:int -w api` green | parent |
| 5 | RED: tests 41–59 and the `ActivatePage` stub edit | web test files | Failing for the right reason | `tdd-guide` |
| 6 | GREEN: API clients, `RequireSession`, `LoginPage`, `LmsPage`, `LessonPage`, routes, header navigation; `DESIGN_SYSTEM.md` | `web/src/**`, `web/DESIGN_SYSTEM.md` | Criteria 9–11; `npm test -w web` and `npm run build -w web` green | parent |
| 7 | One review over API and web | — | Critical and Warning findings fixed | `typescript-reviewer` |
| 8 | Full slice diff, including scope against this plan | — | Findings fixed | `code-reviewer` |
| 9 | **[CRITICAL]** login, logout, guard coverage, enrolment scoping | — | Ends in PASS | `security-reviewer` |
| 10 | Verification (section 8), commits, close the slice (section 9) | docs | Criteria 12–14 | parent |

In semi-auto mode each row is one stop. Task 2 is the only simplified-pipeline task; the
header and page layout parts of task 6 are presentational but ship in the same step as the
guarded pages, so they go through the full pipeline with them.

Focus for `security-reviewer`:
- Every `/api/lms/*` route is behind `SessionGuard` (class-level), and no query takes a student id from anywhere but the token.
- The lesson lookup is scoped by enrolment and by `(courseId, lessonId)`; no path returns a lesson by id alone; the public `GET /api/courses` exposes no lessons.
- Not-enrolled and unknown are indistinguishable (D1), including response bodies.
- Login: identical status and body for both failures; one scrypt run on both paths; the dummy hash is well-formed; no `passwordHash` in any response; nothing typed is logged; body size and password length are bounded before hashing.
- Cookie attributes on login equal those on activation; logout clears with the same `Path`; what logout does not do (no revocation, ADR 008).
- CSRF posture of the two new state-changing routes under `SameSite=Strict` and JSON-only bodies.
- SPA: the guard wraps every LMS route; the cache is emptied at sign-out; lesson bodies are rendered as text; no redirect target is taken from the URL.

## 7. Risks

- **Time.** The roadmap budgets 35 minutes; this plan is closer to an hour with reviews. If time is short, cut in this order: test 30 and 44's second half, M19 (tests 55, 59), the `/login` redirect for signed-in students (test 51). Do not cut any **[S]** API test.
- **Dummy hash that returns early.** A malformed dummy makes unknown-username logins fast and reopens the timing oracle; tests 1 and 3 exist for this.
- **Timing equality is approximate.** A stored hash with older parameters, or the extra database row read, still differs by a little. Good enough here; say so in the ADR.
- **Login is an anonymous scrypt endpoint.** Each attempt costs about 32 MiB and a thread-pool slot; with rate limiting out of scope, a flood slows the API. Recorded under "Rate limiting".
- **Guard resolution in `LmsModule`.** `SessionGuard` is not a provider; Nest builds it in the controller's module, which therefore must import `IdentityModule` to see `SessionService`. A missing import fails at boot, and test 24 would catch it.
- **Non-UUID ids reaching Prisma** give a 500 unless `ParseUUIDPipe` is on both parameters (test 39).
- **`clearCookie` attributes.** The browser drops the cookie only if `path` matches `/api`; test 17 checks the header, the manual check confirms the browser.
- **Existing web tests reject unexpected requests.** The dashboard now calls `GET /api/lms/courses`; `ActivatePage.test.tsx` and the old `LmsPage.test.tsx` need their stubs updated in step 5.
- **Spying on `verifyPassword`.** TypeScript's CommonJS exports are not re-definable, so `jest.spyOn` on the module may throw; use `jest.mock` with `jest.requireActual`.
- **Seed and existing tests.** `seedCourses` now writes lessons in every `beforeEach`; nine upserts per test is negligible, but lesson ids change per reset, so tests address lessons by course subject and position.
- **Stale lesson rows.** A lesson removed from the seed data stays in an existing database; irrelevant from a clean volume, mention in the seed comment.
- **Migration creation needs a database:** `npm run db:dev -w api`, then `prisma migrate dev --name add_lesson`.

## 8. Verification

```
docker compose down -v
docker compose up --build -d --wait
docker compose logs migrate | tail -n 20          # five migrations, courses and lessons seeded

B=localhost:8080
buy() { ID=$(curl -s $B/api/courses | node -pe "JSON.parse(require('fs').readFileSync(0)).find(c=>c.subject==='$1').id"); \
  curl -s -X POST $B/api/orders -H 'content-type: application/json' \
  -d "{\"parentName\":\"Pat\",\"parentEmail\":\"pat@example.com\",\"seats\":[{\"courseId\":\"$ID\",\"year\":7}]}" \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).seats[0].activationCode"; }
act() { curl -s -o /dev/null -w '%{http_code}\n' -X POST $B/api/activations -H 'content-type: application/json' \
  -d "{\"code\":\"$1\",\"firstName\":\"$2\",\"username\":\"$3\",\"password\":\"<test password>\"}"; }
act "$(buy Maths)" Sam sam; act "$(buy English)" Alex alex

curl -s -i $B/api/lms/courses                                           # 401
curl -s -i -c sam.jar -X POST $B/api/session -H 'content-type: application/json' \
  -d '{"username":"sam","password":"<test password>"}'                  # 200 + Set-Cookie
curl -s -i -X POST $B/api/session -H 'content-type: application/json' \
  -d '{"username":"sam","password":"wrong-password"}'                   # 401
curl -s -i -X POST $B/api/session -H 'content-type: application/json' \
  -d '{"username":"nobody","password":"wrong-password"}'                # 401, same body
curl -s -b sam.jar $B/api/lms/courses                                   # Maths only, with lessons
curl -s -c alex.jar -o /dev/null -X POST $B/api/session -H 'content-type: application/json' \
  -d '{"username":"alex","password":"<test password>"}'
# take a Maths courseId and lessonId from sam's dashboard:
curl -s -i -b sam.jar  $B/api/lms/courses/$COURSE/lessons/$LESSON        # 200 with body
curl -s -i -b alex.jar $B/api/lms/courses/$COURSE/lessons/$LESSON        # 404
curl -s -i -b sam.jar -c sam.jar -X DELETE $B/api/session                # 204, cookie cleared
curl -s -i -b sam.jar $B/api/lms/courses                                 # 401
docker compose logs api | grep -i -c 'password'                          # no credential in the log
npm test -w api && npm run test:int -w api && npm test -w web
```

By hand, in the browser at `http://localhost:8080`:
1. Private window, open `/lms` → redirected to `/login`; the same for a lesson URL.
2. Buy Maths / Year 7, open the activation link, create the account → `/lms` shows "Welcome", "Maths · Year 7" and three lessons.
3. Open a lesson, read it, go back; reload on the lesson page and stay in.
4. Sign out → `/login`; browser "Back" does not show the lesson; DevTools shows no `mes_session` cookie.
5. Sign in with a wrong password, then an unknown username → the same message; then the right password → `/lms`.
6. Reuse the activation link → "already used" and the "Sign in" link now leads to a working page.
7. Second student with English: paste the first student's lesson URL → "This lesson is not available."
8. Public product page: the network tab shows no `/api/session` request.
9. Phone width (360px): login, dashboard and lesson are usable.

## 9. Docs to update at close

- New ADRs (after the user's call; suggested split): **025** LMS contract and access rule (D1, D2, M9–M12: enrolment-scoped lookup, not-enrolled answer, `lms` reads lessons through `catalogue`); **026** Login and logout contract (M1–M8: one answer for both failures, dummy verification, lenient login DTO, logout without revocation); lesson content (D3) as a section of 025 or a short **027**. Add each to `adr/README.md` and `PROJECT.md`.
- `ROADMAP.md`: slice 4 → done; "Out of scope" entries from section 1; extend "Rate limiting" to name login.
- `REQUIREMENTS.md`: LMS-1 – LMS-4 → `[x]`.
- `STATE.md`: phase, the "carried into slice 4" list removed, anything carried into slice 5 (the ADR 005 / 023 wording item stays; note that `/login` now exists for the code-through-login flow).
- `web/DESIGN_SYSTEM.md`: `Header` and `PageShell` rows (LMS navigation, "Sign out"), build-status line.
- `api/src/seed/data/course-seed.ts` comment ("Lessons join in slice 4") updated.
- Move this file to `.planning/plans/done/PLAN_slice-4-lms.md`, with a "Decisions made" block and any "changed during implementation" notes.

## 10. Commits

```
docs(planning): plan slice 4 and record LMS decisions
feat(catalogue): lessons table and seed
feat(identity): sign in with username and password, sign out
feat(lms): courses and lessons scoped to the student's enrolments
feat(web): sign in, dashboard and lesson page behind the session
docs(planning): close slice 4
```

## Changed during implementation

- **JSON bodies only.** `security-reviewer` found that the default body parser also accepts
  urlencoded forms, so a form on another site could sign a browser into the attacker's
  account. The API now answers 415 to any body that is not JSON (ADR 026); three tests.
- **LMS cache is scoped to the student.** Both reviewers found that a session that ended
  without "Sign out" left the previous student's courses in the query cache. LMS query keys
  now carry the student id, and sign-in and activation drop all LMS data; test 44 now pins
  that the cache is empty after sign-out, and a new LoginPage test covers the other path.
- **No retry on the dashboard request.** With the default three retries a 401 took about
  seven seconds to reach the sign-in page.
- **The dummy hash is made at start** (`IdentityService.onModuleInit`), as ADR 026 says; it
  was first written lazily.
- **`useSessionExpiry` and `useStudent`** live in their own files, not in `RequireSession`.
- The plan's 59 tests became 63 API cases plus 20 web cases, because several are tables.
