# PLAN — Slice 7 «Same course for two years; activation link for a signed-in student»

> **Done.** Produced by the `planner` subagent on 2026-10-02. The user took every
> recommendation in section 1 (D1–D9, M1–M5).

Two behaviour changes the user asked for after delivery. One student account can hold the
same course for two different years, and a signed-in student who opens an activation link
lands on "Add a course" with the code prefilled. Neither comes from the brief.

**Goal:** a duplicate becomes (student, course, year) instead of (student, course), and
`/activate#code=…` forwards a signed-in student to `/lms/add-course` with the code in the
field, without redeeming it.

**Pipeline:** full, with `security-reviewer` **[CRITICAL]** (redemption path, code handling
in the browser, LMS access lookup).

## 1. Decisions needed

Already decided and followed: lessons do not differ by year (ADR 002, 025); the plain code
lives only in the response, router state and URL fragment (ADR 020); no shared transaction
across modules (ADR 021, 022, 027); sign-in always lands on `/lms` (ADR 026).

### Change 1

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | What a duplicate is | A. (student, course, year). B. No rule on the course at all | A |
| D2 | Dashboard | A. One card per enrolment, each with the same lessons. B. One card per course listing the years | A; key `courseId:year`, ordered by subject then year |
| D3 | Lesson URL and access | A. Unchanged; any enrolment of the course grants access. B. Year in the URL | A |
| D4 | Failure reason | A. Keep `course_already_owned`, texts say "for this year". B. Rename | A |

### Change 2

| # | Question | Options | Recommendation |
|---|---|---|---|
| D5 | Prefill or redeem | A. Prefill; the student presses "Add course". B. Auto-submit | A |
| D6 | How the code travels | A. Router state with `replace`. B. Keep the fragment on `/lms/add-course` | A; ADR 020 gains one line |
| D7 | `/activate` while the session is unknown | "Loading…", no form; 401 or a failed request → onboarding form; no code → onboarding form; decided once | as listed |
| D8 | Signed out with an account: sign in and return with the code | A. Out of scope. B. Carry through sign-in | A |
| D8b | Escape for the wrong account | A. One sentence "Not <name>? Sign out, then open your link again." B. Nothing | A |
| D9 | ADR form | A. ADR 028 and 029 plus notes in 005, 020, 025, 027. B. One ADR. C. Amend only | A |

Defaults to confirm: `REQUIREMENTS.md` unchanged (M1); `AlreadyEnrolledInCourseError`
keeps its name (M2); `findForCourse` stays for access, new `findForCourseYear` for the
duplicate check (M3); a live notice on arrival with a carried code (M4); a type guard for
the carried code in `web/src/carried-activation-code.ts` (M5).

## 2. Acceptance criteria

1. A Maths Year 9 student redeems a Maths Year 10 code: 200, two enrolments, both on the
   dashboard.
2. A second code for the same course and year: 409 `course_already_owned`; the code stays
   unclaimed and a new student can onboard with it.
3. Two codes, same course, different years, concurrently by one student: both 200.
4. Two codes, same course and year, concurrently: exactly one 200; the other code ends
   unclaimed.
5. A lesson opens for a student holding the course in two years; a course not held still
   answers the same 404.
6. Two dashboard cards with distinct headings and no React key warning.
7. Signed in + `/activate#code=X` ends on `/lms/add-course` with X in the field; no
   redemption request is sent; no query or fragment in the address; Back does not return
   to `/activate`.
8. No session: `/activate` behaves as today after a "Loading…" moment.
9. After a successful onboarding the student lands on `/lms`, not on add-course.
10. The plain code is in no log line, query string or storage.
11. The migration applies on a database with enrolments and on a clean one.
12. All three test commands pass; compose starts from scratch with no `.env`.
13. Reviews done; `security-reviewer` ends in PASS.

Out of scope: carrying the code through sign-in; per-year lessons; undoing a wrong add;
showing what a code grants before use; preventing a duplicate at checkout.

## 3. Change 1 in detail

- Migration: drop `Enrolment_studentId_courseId_key`, create a unique index on
  (`studentId`, `courseId`, `year`). The new key is looser, so existing data always fits.
- `EnrolmentService.enrol`: no change in logic; it tells the two constraints apart by
  looking the seat up after a unique violation, not by parsing the error target.
- `findForCourse` becomes a `findFirst` ordered by year; new `findForCourseYear`.
- `listForStudent` and `LearningService.listCourses` order by subject, then year.
- `CourseAdditionService.claimFor`: the duplicate check uses course and year.
- Contracts: comments only. SPA: card key, duplicate text.

## 4. Concurrency under the new key

The ADR 027 sequence is unchanged; only the key of the stale check and of the index
changes. Same course and year at once: both claim, one enrolment is refused, its claim is
released. Different years at once: no shared key, both succeed. The two interleavings fixed
in slice 5 remain possible, so the re-read and the single retry stay. A claimed, unredeemed
code for another year is now completed as a normal resume instead of being released.

## 5. Change 2 in detail

- `/activate` stays outside the guard and reads the session with the shared session key,
  `retry: false`.
- The code is read once from the fragment into component state.
- One effect decides: strip the fragment; when the first session answer is a student and
  there is a code, `navigate('/lms/add-course', { replace: true, state })`; otherwise show
  the form. A second competing navigation would put the student back on `/activate`.
- The decision is latched: after a successful onboarding the page itself puts a student
  into the session cache, and must not then redirect with the code just used.
- `AddCoursePage` reads the router state through the type guard once, as the form's
  default value; the field stays editable; nothing is sent until submit.
- If the guard sends the student to `/login`, the state is dropped.

| Situation | Result |
|---|---|
| No session, link with a code | "Loading…", then the onboarding form prefilled |
| Session, link with a code | "Loading…", then add-course prefilled; nothing redeemed |
| Session expired or request failed | Onboarding form |
| Session, link without a code | Onboarding form |
| Session, code used by someone else | Prefill; on submit "already used" |
| Session, code for a course and year already held | Prefill; on submit the duplicate notice; the code stays valid |
| Session cached in the SPA but expired on the server | Redirect, then `/login`; the code is not carried |
| Reload on add-course after the redirect | The prefill survives |

## 6. RED tests

API (`enrolment.int.spec.ts`, `redemption.int.spec.ts`, `lms.int.spec.ts`): duplicate by
course and year; second year creates a row; `findForCourseYear`; another year redeems with
200 and the dashboard lists both in order; concurrent different years both succeed;
concurrent same year one succeeds and the other code is redeemable; a residue for another
year is completed; lesson opens with two years and another course is still the identical
404; logging test covers the new action.

Web: `carried-activation-code` guard; `ActivatePage` — loading state without a form,
redirect with the code and no request sent, clean address and history, no code → form,
failed session → form, after 201 on `/lms`, a later session change does not move the
student, cached session redirects once; `AddCoursePage` — prefilled and editable from
state, wrong-shaped state ignored, submit sends the code, no session → `/login` with no
state, new duplicate text; `LmsPage` — two cards for one course, no key warning.

## 7. File scope

`api/prisma/schema.prisma` and a new migration; `api/src/lms/enrolment.service.ts`,
`learning.service.ts`; `api/src/activation/course-addition.service.ts`; the three
integration specs; `packages/contracts` (comment); `web/src/pages/ActivatePage.tsx`,
`AddCoursePage.tsx`, `LmsPage.tsx` with tests; new `web/src/carried-activation-code.ts`.
Not touched: `LoginPage`, `RequireSession`, `App`, `LessonPage`, the LMS controller.

## 8. Tasks

1. Decisions; ADR 028, 029 and notes; `PROJECT.md`, `STATE.md`.
2. RED API (`tdd-guide`) → GREEN.
3. RED web (`tdd-guide`) → GREEN.
4. `typescript-reviewer` → `code-reviewer` → `security-reviewer` [CRITICAL].
5. Verification, docs, commits.

Security review focus: the code never in a query string, log, query key or storage; no
history entry keeps `/activate#code=…`; router state validated and not passed to `/login`;
no auto-redemption; the latch; the LMS access rule unchanged; release cannot free a
redeemed code or another student's claim; error bodies name no course, year or student.

## 9. Docs

ADR 028, 029; notes in 005, 020, 025, 027; register; `PROJECT.md`; `README.md` (things to
try, the unique-index sentence, key decisions, number of ADRs, limitations, test counts);
`ROADMAP.md` (slice 7 row, out-of-scope wording); `STATE.md`.

## 10. Risks

- The clean-clone check must be repeated and the README test counts recounted.
- About 25 existing `ActivatePage` tests render the form synchronously and need a wait.
- Double navigation and a missing latch are the two likely bugs.
- `retry: false` on `/activate` shares a query key with observers using the default.
- Two cards with identical lessons look odd; recorded as a limitation, per ADR 002.
- The existing local volume gets the migration in place; `--build` is required.

## Changed during implementation

- **A cached session does not count as an answer** (`typescript-reviewer`). The page first
  decided as soon as the cache held anything, so a stale "signed out" left by an earlier
  page showed the onboarding form to a signed-in student. It now waits for the API. Test
  added.
- **The code is removed from the history entry once it is in the field**
  (`security-reviewer`, Low). The plan kept it there so a reload would keep the prefill;
  at a shared browser "Back" would then show an unused code to the next student. ADR 029
  was amended: a reload loses the prefill. Test added.
- **Double navigation was a real bug during GREEN**, as the plan warned: with the session
  already cached, removing the fragment cancelled the navigation to add-course. The effect
  now makes at most one navigation per run.
- **Integration test apps bind to 127.0.0.1** — outside the plan's scope, in its own
  commit. A run where every request timed out was traced to another program on the machine
  holding the same port number on 127.0.0.1 while supertest bound the wildcard address.
  This also explains the one unexplained hang reported in slice 5.
- One limit for a code entering the SPA (`CODE_INPUT_MAX_LENGTH`) instead of three copies.
- `security-reviewer`: PASS. Not changed: a link crafted by someone else can prefill their
  code for a signed-in student; the worst case is a course they paid for, after a click.
- During a check of the new history test the parent session discarded the uncommitted SPA
  changes with a mistaken `git checkout`. They were restored from the session's own records
  and re-verified (139 SPA tests, as before); the work was committed right after.
- Verified by hand: the migration applied on the existing volume with five enrolments;
  Maths Year 9 plus Year 10 on one account; the same year refused and its code left valid;
  the link forwarded a signed-in student, prefilled, sent no request until submit; no code
  in the API logs.
