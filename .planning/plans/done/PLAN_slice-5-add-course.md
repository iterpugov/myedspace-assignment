# PLAN — Slice 5 «Add a course to an existing account»

> **Done, in the smallest variant (section 11).** Produced by the `planner` subagent on 2026-10-02. Section 2 lists the decisions the user
> has to make before `tdd-guide` starts; sections 3–10 assume the recommendations (variant A,
> D1-A, D2-A, D3-C, D4-A) and must be adjusted if the user chooses otherwise.

Slice 5 lets a signed-in student redeem a second activation code, so a second purchase for
the same child lands on the account the child already has. On the API it adds one guarded
endpoint in `activation` that reuses the ADR 022 sequence without the "create student" step.
On the web it adds a code-entry page in the LMS and a way to bring the code from the
activation link through sign-in.

## 0. What the brief requires and what it does not

**The brief requires nothing in this slice.** `task.txt` asks for: the parent selects a
course, a mock checkout, a student access path, an onboarding form, account activation, and
an LMS for authenticated students. Every requirement in `REQUIREMENTS.md` that maps to those
is already `[x]` after slice 4. The brief never mentions a second purchase, an existing
account, or several courses per student.

| Part of slice 5 | Source | Required by the brief |
|---|---|---|
| Redeem a code for the signed-in student (API) | ADR 005 | No |
| Code entry in the LMS | ADR 005 | No |
| Duplicate purchase rejected, code stays valid | ADR 005 | No |
| Code carried through login | ADR 005 | No |
| "This account exists, log in" on the activation form | ADR 005 (conflicts with ADR 023) | No |

What happens today without the slice:
- A second code for the same child still works, but only by creating a second account with
  another username. The paid seat is not lost; the child ends up with two logins.
- ADR 005 already says the slice is "the first to be cut if time runs out" and that the
  README then lists it as a known limitation.

What the slice would add for the reviewers:
- A second cross-module write sequence with a real ordering problem (check, claim, enrol,
  release), which is the distributed-systems discipline the user wants to show.
- A fix for the "Accounts without a course" out-of-scope entry: such an account could add a
  code.

Cost: the roadmap says 25 minutes. Judging by slices 3 and 4, variant A is closer to 70–80
minutes with three reviews, and variant B to 40–50. Slice 6 (README, clean-clone check) is
mandatory and still to do.

## 1. Goal and done criteria

**Goal:** a signed-in student adds a course to their account with a second activation code;
a code for a course they already have is rejected and stays valid for another student.

**Requirements covered:** none from `REQUIREMENTS.md`; the source is ADR 005. TEC-3 is not
affected.

| # | Criterion | Check |
|---|-----------|-------|
| 1 | Add a course | `POST /api/redemptions` with a session and a valid code creates the enrolment for the session's student; the dashboard then lists two courses |
| 2 | Session only | Without a valid cookie the endpoint answers 401 and the code is untouched; the student id comes only from the token |
| 3 | Duplicate | A code for a course the student already has answers 409 `course_already_owned`; the code row stays unclaimed and another student can redeem it (roadmap done criterion) |
| 4 | Single use | A code used by someone else answers 409 `code_used`; of two students racing for one code exactly one wins |
| 5 | Resumable | A failure after the claim leaves a claimed, unconfirmed code; the next presentation finishes it for the claiming student, never for the presenter |
| 6 | No burnt seat | No sequence of failures or races leaves an unredeemed code claimed for a student who cannot get its enrolment (D1) |
| 7 | Code entry in the LMS | `/lms/add-course` has a code form; success returns to a dashboard that shows the new course without a reload |
| 8 | Code through login | From `/activate` an existing student reaches sign-in and then the add-course form with the code prefilled; the code never appears in a query string, path or storage (D2) |
| 9 | Wording | The activation form's taken-username message follows D3 |
| 10 | No leak | The plain code is in no log line and no URL |
| 11 | Tests | `npm test -w api`, `npm run test:int -w api`, `npm test -w web` pass |
| 12 | Clean clone | `docker compose down -v && docker compose up --build -d --wait` exits 0 with no `.env` |
| 13 | Reviews | `typescript-reviewer`, `code-reviewer`; `security-reviewer` ends in PASS |

**Out of scope** (new entries go to `ROADMAP.md` "Out of scope" when closing):
- Naming the course before it is added: there is no "check this code" endpoint (ADR 023). Production: the link opens a page that shows what the code grants.
- Undoing a course added to the wrong account (shared browser, sibling signed in). Production: support or the parent's account moves it.
- Keeping a carried code when the session expires on the add-course page; the student pastes it again.
- A lease or automatic retry for an interrupted redemption (ADR 022 already defers this).
- Rate limiting on the new endpoint (covered by the existing entry).
- Resolving a duplicate purchase (already recorded).

## 2. Decisions needed

> **Decisions made (user, 2026-10-02):** D0-B (smallest viable variant, section 11) and
> D1-A (check, claim, enrol; release on the residue). D2 and D4 drop out; D3 is "ADR 023
> wins" plus one static sentence on the activation form. M1–M19 accepted as proposed, minus
> those that belong to the carried code (M14). Recorded in ADR 027; ADR 005 and ADR 022
> amended.

### Already decided — the plan follows these, no call needed

| Question | Answer | Source |
|---|---|---|
| Which module owns "redeem for the signed-in student" | `activation`. It already depends on `identity` and `lms`; putting it in `lms` would make `lms → activation → lms` a cycle | ADR 012, kickoff constraint |
| Shared transaction across modules | None. Each module writes in its own transaction | ADR 021, ADR 022 |
| One enrolment per course per student; duplicate rejected; code stays valid | Yes; `@@unique([studentId, courseId])` and `AlreadyEnrolledInCourseError` already exist | ADR 005 |
| Identity of the student | The session's student; nothing in the body or URL | ADR 005, ADR 025 |
| Status codes | 400 shape, 422 business rule, 409 conflict, 415 non-JSON | ADR 018, 023, 026 |
| Code handling | Never logged; fragment in links; removed from the address after reading | ADR 020 |
| Unknown vs used code answered differently | Yes, as on onboarding | ADR 023 |
| Database schema | No migration: `claimedByStudentId` and `redeemedAt` are enough | ADR 022 |

### Needs the user's call before code

**D0 — Size of the slice.**

| Option | What is built | Rough cost |
|---|---|---|
| A. Full | Everything in this plan | 70–80 min |
| B. Smallest viable (section 11) | The API as planned, a code form in the LMS, the duplicate message. No code through login, no changes to `LoginPage`; the activation page gets one sentence and a plain link | 40–50 min |
| C. Skip | Nothing; README lists the limitation, as ADR 005 allows; go to slice 6 | 0 |

Recommendation: **B** if time remains after reserving slice 6, otherwise **C**. B keeps the
part that shows engineering judgment (the redemption sequence and its races) and drops the
part that is mostly UI plumbing and forces amendments to ADR 023 and ADR 026. Doing slice 6
first and slice 5 after is a safe order, because slice 6 is mandatory. With B, D2 and D4
disappear and D3 becomes "ADR 023 wins".

**D1 — Order of the duplicate check and the claim, and whether a claim can be released.**

ADR 022 claims first and enrols second. ADR 005 says a duplicate leaves the code valid. A
claim followed by "already enrolled" would leave the code claimed for a student who can
never get its enrolment: a burnt paid seat.

| Option | Sequence | Trade-off |
|---|---|---|
| A. Check, claim, enrol; release on the residue | `lms` is asked "does this student have this course?" before the claim; a duplicate stops there with the code untouched. If the enrolment still fails with `AlreadyEnrolledInCourseError` after the claim, `activation` releases the claim with a conditional update | The expected failure needs no compensation, the same principle as "student first" in ADR 022. The check is not atomic with the claim: the same student redeeming two codes for one course at the same moment passes both checks. Release covers that, and resume applies the same release if the process dies in between. Adds one method and about three tests. A claim is no longer strictly "set once" |
| B. As A, without release | The same, but the race residue stays claimed and unredeemed, logged | Least code. A duplicate seat is lost in the same-instant double redemption, which contradicts ADR 005 in that narrow case |
| C. Claim first, release on every duplicate | ADR 022 order unchanged; a duplicate always compensates | No check-then-act gap. The expected failure needs compensation, and a crash between claim and release burns the code until someone presents it again. ADR 022 rejected this pattern for a taken username |
| D. Enrol first, claim second | The unique `(student, course)` index rejects a duplicate atomically before any claim | No gap for duplicates. A lost claim leaves an enrolment on a seat whose code belongs to someone else, which needs a compensating delete in `lms` and blocks the real owner. ADR 022 rejected the enrolment as the gate |

Recommendation: **A**. Release is safe because `AlreadyEnrolledInCourseError` means no
enrolment uses this seat, so nothing was consumed. The condition is
`claimedByStudentId = <that student> AND redeemedAt IS NULL`.

**D2 — How the code travels from `/activate` through sign-in** (drops out with D0-B).

| Option | Trade-off |
|---|---|
| A. Router state | `navigate('/login', { state: { activationCode } })`; after sign-in `LoginPage` goes to the fixed route `/lms/add-course` with the same state. Not in the URL, never sent to the server, same mechanism ADR 020 chose for the confirmation page. Lives in `history.state` of one entry, survives a reload, and is lost if the student opens `/login` in another tab |
| B. `sessionStorage` | Survives any navigation in the tab, including a guard redirect. ADR 020 rejected it for the code: script-readable storage that outlives the page and needs explicit cleanup on every exit path |
| C. In-memory only (module variable or context) | Nothing persisted. Lost on reload; hidden shared state that tests must reset |
| D. Not carried | The student copies the code and pastes it in the LMS. No change to `LoginPage` or ADR 026. This is variant B of D0 |

Recommendation: **A**. The destination is chosen by code, not read from the URL, so the ADR
026 rule holds. But the ADR 026 sentence "always lands on `/lms` after sign-in" must be
amended to "on `/lms`, or on the add-course page when a code was carried in router state".

**D3 — Taken username on the activation form: ADR 005 wording or ADR 023 wording.**

Revealing that a username exists is already the case (ADR 023, ADR 026 consequences), so the
options differ only in what the student is told to do.

| Option | Trade-off |
|---|---|
| A. ADR 023 wins | "That username is taken. Choose another." No sign-in hint. A returning student who types their own username gets no help. ADR 005 row 2 is amended |
| B. ADR 005 wins | "This account exists, please log in" with a link carrying the code. Misleads a new student who merely collided with someone else's username |
| C. Both | Under the field: "That username is taken. Choose another, or sign in if it is yours." with a "Sign in" link that carries the code. Plus a standing line above the form: "Already have an account? Sign in to add this course to it." |

Recommendation: **C** with variant A of D0; **A** plus a plain, non-carrying sentence with
variant B. In C the standing link is the main path, and the error text only points to it.
ADR 023 and ADR 005 are both amended with the final wording.

**D4 — A signed-in student opens the activation link** (drops out with D0-B).

| Option | Trade-off |
|---|---|
| A. `/activate` stays anonymous | The page makes no session request. The standing link from D3-C goes to `/login`; `LoginPage` already sees an existing session and forwards, now to `/lms/add-course` with the code. One click, no new request on the page, existing `ActivatePage` tests keep their stubs |
| B. `/activate` asks for the session and forwards automatically | Closest to ADR 005 row 3. A session request and a loading state on the page. A sibling at a shared browser who wants a new account is pushed into the other child's LMS, so an escape link is needed |
| C. `/activate` adds the course automatically when signed in | Fewest clicks. A course lands on whichever account happens to be signed in, with no confirmation and no undo |

Recommendation: **A**. In every option the course is added only by an explicit submit on a
page that shows whose account it is. Not C.

### Proposed defaults — confirm or change

| # | Detail | Default | Why |
|---|---|---|---|
| M1 | Endpoint | `POST /api/redemptions`, body `{ code }`, **200** with `{ courseId, year }`, `Cache-Control: no-store`, no `Set-Cookie` | 200, not 201, because a repeat is answered the same way (M5). Alternative name: `POST /api/activations/redemptions` |
| M2 | Controller | A new `RedemptionController` in `activation` with `@UseGuards(SessionGuard)` on the class; `ActivationController` stays anonymous | A guarded route cannot be left open by being added to the anonymous class |
| M3 | Failure contract | 422 `code_invalid`; 409 `code_used`; 409 `course_already_owned`; 401 no session; 400 shape; 415 non-JSON. A separate `RedemptionFailureReason` union, not an extension of `ActivationFailureReason` | Onboarding can never answer "already owned"; the web's exhaustive reason tables stay honest |
| M4 | Student must exist | The use case calls `IdentityService.findById` first and answers 401 if the student is gone | The guard reads no database (ADR 008). A token that outlives its student (volume wiped, `JWT_SECRET` set in `.env`) would otherwise claim a code and then fail on the enrolment foreign key: a burnt code |
| M5 | The student's own code again | Claimed by the caller: finish if needed and answer 200 with the same body | Double click, two tabs and retry after a 5xx are all safe. It reveals nothing: it is their code |
| M6 | Order of answers | Claimed code is handled before the duplicate check: someone else's used code answers `code_used` even when the caller has that course | Otherwise a resumed redemption on the caller's own seat would be reported as a duplicate |
| M7 | Lost claim | After a lost claim the code is read once more: claimed by the caller means M5, otherwise `code_used` | Two tabs of one student both succeed; two students get one winner |
| M8 | Resume for another student | Same as onboarding: best effort for the student in the claim, then `code_used` | ADR 022 |
| M9 | Service layout | `finish` and `resume` move from `OnboardingService` into an internal `RedemptionSteps` provider; a new `CourseAdditionService.addCourse(studentId, code)` uses it. Neither is exported from the module | One implementation of the claim-completion steps for both use cases |
| M10 | Response has no subject | `activation` does not depend on `catalogue`; the dashboard refetch shows the subject | No new module dependency |
| M11 | DTO | `RedeemCodeRequestDto { code }` with the same transform and validators as onboarding, shared through one composed decorator. `studentId` or any other property is a 400 | ADR 018 |
| M12 | Logging | "Course added for student <id>" and "Student <id> presented a code for a course they already have"; never the code | ADR 020 |
| M13 | Web route | `/lms/add-course` inside `RequireSession`; the dashboard gets an "Add a course" link, in the header navigation and in the empty-state notice | The dashboard keeps no form logic; the guard already covers it |
| M14 | Prefill | The page reads `location.state.activationCode` through a type guard (string, at most 64 characters); anything else is ignored. The field is editable | Same guard style as `ConfirmationPage` |
| M15 | After success | Invalidate `lmsKeys.courses(student.id)`, then `navigate('/lms', { replace: true })`; mutation `gcTime: 0` | The new card is the confirmation; the code leaves history and the cache |
| M16 | Messages | Duplicate: "You already have this course. This purchase is a duplicate: ask your parent to contact us. The code has not been used." Used: "This code has already been used." Invalid: under the field, same text as onboarding | ADR 005 wording |
| M17 | 401 on submit | `useSessionExpiry` accepts any API error with `status === 401`, not only `LmsError` | The session can end while the form is open |
| M18 | Test helper | `buyCode(app, subject, year)` moves into `api/src/testing/onboarding.ts` | Two spec files need it |
| M19 | Add-course page shows the account | Heading "Add a course to <first name>'s account" | The explicit confirmation D4 relies on |

## 3. Design

Assumes D0-A, D1-A, D2-A, D3-C, D4-A and M1–M19.

### Sequence (`CourseAdditionService.addCourse(studentId, code)`)

1. `identity.findById(studentId)`; missing → 401.
2. `activation.findByCode(code)`; missing → 422 `code_invalid`.
3. If the code is unclaimed:
   1. `lms.findForCourse(studentId, code.courseId)`; found → 409 `course_already_owned`, code untouched.
   2. `activation.claim(code.id, studentId)`; lost → read the code again.
4. If the code is claimed by another student: best-effort resume for that student, then 409 `code_used`.
5. The code is claimed by the caller: `lms.enrol(...)` (idempotent per seat), then `activation.confirm(code.id)`.
6. If step 5 throws `AlreadyEnrolledInCourseError`: `activation.release(code.id, studentId)`, then 409 `course_already_owned`.
7. 200 `{ courseId, year }`.

| Failure | Left behind | Outcome |
|---|---|---|
| Duplicate course | Nothing | 409; the code works for another student |
| Crash after the claim, before the enrolment | Claimed, unconfirmed code | Finished on the next presentation; the caller's own retry answers 200 |
| Enrolment or confirmation fails | The same | The same |
| Two students, one code | Nothing for the loser | One 200, one `code_used` |
| One student, one code, two tabs | Nothing | Both 200, one enrolment |
| One student, two codes for one course, same moment | A claim that is released | One 200, one `course_already_owned`; the second code is free again |
| Crash between the failed enrolment and the release | Claimed, unconfirmed code | Released on the next presentation by `RedemptionSteps` |

A code comment on `CourseAdditionService` states the trade-off: the duplicate check is a
read in `lms` followed by a write in `activation`, not one transaction, so it can be stale;
the unique index in `lms` is the real rule and release is the compensation for the gap.

### Contract (`packages/contracts/src/index.ts`)

```ts
export interface RedeemCodeRequest { code: string }
/** The course added to the signed-in student's account. */
export interface RedeemCodeResponse { courseId: string; year: number }
export type RedemptionFailureReason = 'code_invalid' | 'code_used' | 'course_already_owned';
export interface RedemptionErrorResponse { statusCode: number; message: string; reason: RedemptionFailureReason }
```

### Endpoints

| Method and path | Guard | Success | Failures |
|---|---|---|---|
| `POST /api/redemptions` | `SessionGuard` (class) | 200 `RedeemCodeResponse` | 401; 400 shape; 415; 422 `code_invalid`; 409 `code_used`; 409 `course_already_owned` |
| `POST /api/activations` | none | unchanged | unchanged |

### Module surfaces and dependencies

| Module | Change |
|---|---|
| `activation` | `ActivationService.release(codeId, studentId): Promise<boolean>`; internal `RedemptionSteps` (`finish`, `resume`, extracted); `CourseAdditionService`; `RedemptionController`; `RedeemCodeRequestDto`. `OnboardingService` behaviour is unchanged |
| `lms` | None. `EnrolmentService.findForCourse` and `enrol` already exist and are exported |
| `identity` | None. `IdentityService.findById`, `SessionGuard`, `CurrentStudentId` already exist |

Dependency direction is unchanged: `activation → {identity, lms}`.

### Web

| Route | Element | Behaviour |
|---|---|---|
| `/activate` | `ActivatePage` | Unchanged form. New standing link "Already have an account? Sign in to add this course to it." navigating to `/login` with the current value of the code field in router state. Taken-username message per D3-C, with the same link |
| `/login` | `LoginPage` | Reads a carried code from router state through the M14 guard. After sign-in, or when already signed in: with a code → `/lms/add-course` with the state, `replace`; without → `/lms` as today. Nothing is read from the query string |
| `/lms/add-course` | `AddCoursePage` (inside `RequireSession`) | M19 heading, code field (prefilled, editable), "Add course" button, messages per M16, success per M15 |
| `/lms` | `LmsPage` | "Add a course" link; the empty-state notice points to it |

## 4. File scope

| File | Change |
|---|---|
| `packages/contracts/src/index.ts` | Four types above |
| `api/src/activation/activation.service.ts` | `release` |
| `api/src/activation/redemption-steps.ts` | New: `finish`, `resume`, release on the residue |
| `api/src/activation/onboarding.service.ts` | Uses `RedemptionSteps`; class comment updated |
| `api/src/activation/course-addition.service.ts` | New |
| `api/src/activation/redemption.controller.ts` | New |
| `api/src/activation/dto/redeem-code-request.dto.ts` | New |
| `api/src/activation/dto/activation-request.dto.ts` | Code decorators shared |
| `api/src/activation/activation.module.ts` | New providers and controller |
| `api/src/activation/redemption.int.spec.ts` | New |
| `api/src/activation/activation.int.spec.ts` | `buyCode` from the helper; one residue test |
| `api/src/testing/onboarding.ts` | `buyCode` |
| `api/prisma/schema.prisma` | Comment on `claimedByStudentId` only ("set once" is no longer exact); no migration |
| `web/src/api/activations.ts` | `redeemCode`, `RedemptionError` |
| `web/src/carried-activation-code.ts` (+ test) | New: the M14 guard |
| `web/src/pages/AddCoursePage.tsx` (+ test) | New |
| `web/src/pages/LoginPage.tsx`, `ActivatePage.tsx`, `LmsPage.tsx` (+ tests) | As in section 3 |
| `web/src/App.tsx`, `RequireSession.tsx` (+ test) | Route; header link |
| `web/src/use-session-expiry.ts` | M17 |
| `web/src/ui/TextLink.tsx` | Pass `state` through, if it does not already |
| `web/DESIGN_SYSTEM.md` | Header row |

## 5. Tests for `tdd-guide` (RED before code)

**[S]** marks a security case; none of them may be cut.

### API integration — `api/src/activation/redemption.int.spec.ts` (new)

1. **[S]** No cookie → 401; the code row is unclaimed.
2. **[S]** Garbage cookie, expired token, token signed with another secret → 401 each.
3. A Maths student redeems an English code → 200 with exactly `courseId` and `year`, `Cache-Control: no-store`; one new enrolment with the code's course, year and seat; the code is claimed by the student and redeemed; `GET /api/lms/courses` lists two courses.
4. The code is accepted in lower case without hyphens.
5. **[S]** The response sets no cookie.
6. **[S]** A body with another student's `studentId` → 400; nothing stored.
7. **[S]** With the second student's cookie the enrolment belongs to the second student; the first has none for that course.
8. A well-formed unknown code → 422 `code_invalid`; nothing stored.
9. Malformed bodies → 400 (table: no code, a number, 65 characters, wrong alphabet, extra property, empty object).
10. **[S]** A urlencoded body → 415.
11. Duplicate: a Maths student redeems a second Maths code → 409 `course_already_owned`; the code is unclaimed and unredeemed; still one enrolment; a new student then onboards with that code → 201.
12. Duplicate with another year (Maths Year 8 for a Maths Year 7 student) → 409 `course_already_owned`.
13. A code redeemed by another student → 409 `code_used`; nothing changes.
14. **[S]** A used code for a course the caller already has → `code_used`, and the body names no student.
15. The caller's own redeemed code again → 200 with the same body; one enrolment.
16. One student, one code, two concurrent requests → both 200; one enrolment.
17. Two students, one code, concurrent → exactly one 200 and one 409 `code_used`; one enrolment, for the winner.
18. One student, two codes for one course, concurrent → one 200 and one 409 `course_already_owned`; one enrolment; the loser's code ends unclaimed and another student can redeem it (D1-A).
19. Onboarding and add-course racing for one code → exactly one succeeds.
20. `lms` fails after the claim (failing app, as in the onboarding spec) → 5xx; the code is claimed by the caller and unredeemed; the caller retries on the healthy app → 200 and one enrolment.
21. **[S]** A code claimed by Sam and unconfirmed, presented by Alex → 409 `code_used`; the enrolment is created for Sam, none for Alex.
22. Confirmation fails after the enrolment → retry answers 200 without a second enrolment.
23. Residue: a code claimed by a student who already has the course through another seat, unredeemed (set up in the database) → presenting it answers 409 `course_already_owned` and the code becomes unclaimed.
24. **[S]** A valid token for a student id that has no row → 401; the code is unclaimed.
25. A student with no course (ADR 022 leftover) redeems a code → 200 and one enrolment.
26. **[S]** No log line written during a redemption, a duplicate and a failure contains the plain code.

### API integration — `api/src/activation/activation.int.spec.ts` (additions)

27. `ActivationService.release`: releases a claim of that student that is not redeemed; does not release a redeemed code; does not release another student's claim.
28. The existing onboarding cases stay green after the extraction (no new case).

### Web — `web/src/carried-activation-code.test.ts`

29. Returns the string from `{ activationCode }`; returns `''` for missing state, a non-string and more than 64 characters.

### Web — `web/src/pages/AddCoursePage.test.tsx`

30. Shows the student's first name and a code field prefilled from router state; empty without state.
31. Empty and ill-formed codes show a field error and send no request.
32. Sends `POST /api/redemptions` with exactly `{ code }`, trimmed.
33. After a 200 the page ends on `/lms`, the courses request is made again and the new course is shown.
34. `course_already_owned` → the duplicate message naming the parent; the code stays in the field.
35. `code_used` → its message; `code_invalid` → under the field; 500 → generic notice.
36. **[S]** 401 on submit → ends on `/login`.
37. The button is disabled while the request is pending.

### Web — `LoginPage.test.tsx`, `ActivatePage.test.tsx`, `LmsPage.test.tsx`, `RequireSession.test.tsx` (additions)

38. Login with a carried code → after a 200 the add-course page shows the code prefilled.
39. Already signed in with a carried code → add-course page, no login request.
40. **[S]** `/login?next=/elsewhere&code=ABCDE…` → lands on `/lms`; nothing from the query is used.
41. The activation page's standing link leads to `/login` carrying the current value of the code field, including after the student edited it.
42. **[S]** After that navigation the address has no query and no fragment.
43. `username_taken` → the D3 message under the field with a "Sign in" link.
44. The dashboard has an "Add a course" link to `/lms/add-course`; the empty state points to it.
45. **[S]** `/lms/add-course` without a session → `/login`.

## 6. Ordered tasks

| # | Task | Files | Acceptance | Pipeline |
|---|---|---|---|---|
| 1 | User decides D0–D4 and confirms M1–M19; record the ADR and amendments, `PROJECT.md`, `STATE.md`; save this plan | `.planning/**` | ADR accepted; section 2 gets a "Decisions made" block | — |
| 2 | Contract types; `buyCode` helper | contracts, `api/src/testing/onboarding.ts` | Builds; existing suites green | simplified, reviewed in task 8 |
| 3 | RED: tests 1–27 | API spec files | Failing for the right reason (no route, no method) | `tdd-guide` |
| 4 | GREEN: `release` → `RedemptionSteps` extraction (onboarding suite green) → `CourseAdditionService` → DTO, controller, module wiring; refactor | `api/src/activation/**` | Criteria 1–6, 10; API suites green | parent |
| 5 | RED: tests 29–45 | web test files | Failing for the right reason | `tdd-guide` |
| 6 | GREEN: API client, guard helper, `AddCoursePage`, route, `LoginPage`, `ActivatePage`, `LmsPage`, header link | `web/src/**`, `web/DESIGN_SYSTEM.md` | Criteria 7–9; `npm test -w web` and `npm run build -w web` green | parent |
| 7 | One review over API and web | — | Critical and Warning findings fixed | `typescript-reviewer` |
| 8 | Full slice diff, including scope against this plan | — | Findings fixed | `code-reviewer` |
| 9 | **[CRITICAL]** redemption for an existing account | — | Ends in PASS | `security-reviewer` |
| 10 | Verification (section 8), commits, close the slice (section 9) | docs | Criteria 11–13 | parent |

In semi-auto mode each row is one stop. The pipeline is full, with `security-reviewer`
**[CRITICAL]**: ADR 005 puts both redemption operations on the security-review list.

Focus for `security-reviewer`:
- The endpoint is behind a class-level `SessionGuard`; the student id comes only from the token; a body cannot name a student.
- No path enrols the presenter on a code claimed by someone else; resume always uses the claim's student.
- Release cannot free a redeemed code or another student's claim, and cannot be reached while an enrolment uses the seat.
- A token without a student cannot claim a code.
- The answers reveal nothing beyond ADR 023: no owner, no course for a code the caller cannot use.
- The plain code is in no log, URL, query cache or storage; router state is validated before use.
- `LoginPage` takes no destination and no code from the URL.
- CSRF posture of the new state-changing route under `SameSite=Strict` and JSON-only bodies.

## 7. Risks

- **Time.** The roadmap budgets 25 minutes; variant A is about three times that. Cut order if short: tests 19, 22, 16; then D2 and D4 (falling back to variant B). Do not cut any **[S]** test or tests 11 and 18.
- **Extraction breaks onboarding.** Moving `finish` and `resume` touches the slice 3 path; the onboarding spec is the safety net and must be green before any new behaviour is added. Its failing-app tests override providers, so check they still inject after the move.
- **Check-then-act gap.** The duplicate check can be stale; test 18 exists for this. It may need several attempts to hit the race; write it so both outcomes of the interleaving pass.
- **Release widens the claim.** A bug in its condition would make a code reusable. Test 27 pins the three cases.
- **Ghost student.** Without M4 a stale token burns a code on a foreign-key error; test 24.
- **Wrong account.** At a shared browser a course can be added to a sibling's account, with no undo. Mitigated by M19 and the explicit submit; recorded as out of scope.
- **Router state lifetime.** The code sits in `history.state` of the login or add-course entry until that entry is replaced; ADR 020 already accepts this for the confirmation page.
- **Existing web tests reject unexpected requests.** D4-A was chosen partly so `ActivatePage` makes no new request; `LmsPage` and `LoginPage` stubs need the new routes only in the new tests.
- **Amending accepted ADRs.** D2-A changes a sentence of ADR 026, and D3 changes ADR 005 and ADR 023; the amendments must land before code depends on them.

## 8. Verification

```
docker compose down -v
docker compose up --build -d --wait

B=localhost:8080
# buy() and act() as in the slice 4 plan
MATHS=$(buy Maths); ENGLISH=$(buy English); MATHS2=$(buy Maths)
act "$MATHS" Sam sam
redeem() { curl -s -i -b "$1" -X POST $B/api/redemptions -H 'content-type: application/json' -d "{\"code\":\"$2\"}"; }

curl -s -i -X POST $B/api/redemptions -H 'content-type: application/json' -d "{\"code\":\"$ENGLISH\"}"   # 401
curl -s -c sam.jar -o /dev/null -X POST $B/api/session -H 'content-type: application/json' \
  -d '{"username":"sam","password":"<test password>"}'
redeem sam.jar "$ENGLISH"                    # 200 {courseId, year}
redeem sam.jar "$ENGLISH"                    # 200 again, same body
curl -s -b sam.jar $B/api/lms/courses        # English and Maths
redeem sam.jar "$MATHS2"                     # 409 course_already_owned
act "$MATHS2" Alex alex                      # 201: the code stayed valid
curl -s -c alex.jar -o /dev/null -X POST $B/api/session -H 'content-type: application/json' \
  -d '{"username":"alex","password":"<test password>"}'
redeem alex.jar "$ENGLISH"                   # 409 code_used
redeem alex.jar AAAAA-AAAAA-AAAAA            # 422 code_invalid
curl -s -i -b sam.jar -X POST $B/api/redemptions -d "code=$ENGLISH"       # 415
docker compose logs api | grep -c -e "$ENGLISH" -e "$MATHS2"              # 0
npm test -w api && npm run test:int -w api && npm test -w web
```

By hand, in the browser at `http://localhost:8080`:
1. Buy Maths, activate as a new student, land on the dashboard with one course.
2. Sign out. Buy English, open its link: the form shows "Already have an account?". Follow it, sign in: the add-course page shows the student's name and the code prefilled; the address bar never shows the code.
3. Submit: the dashboard shows English and Maths without a reload.
4. Buy Maths again, open the link while signed in, follow the link: no login form, straight to add-course; submit → duplicate message.
5. Sign out, open the same Maths link, create a new account with it: it works.
6. On the activation form type an existing username → the D3 message and a working "Sign in" link.
7. From the dashboard choose "Add a course", paste a used code → "already used"; a mistyped code → field error.
8. Browser "Back" after adding a course does not return to a form holding the code.
9. Private window: `/lms/add-course` redirects to `/login`.
10. Phone width (360px): the add-course page is usable.

## 9. Docs to update at close

- New **ADR 027** "Adding a course to an existing account": the D1 sequence and failure table, release, the student-exists check, the endpoint and its answers (M1–M8). Marks ADR 022 as amended ("a claim can be released when the enrolment is refused as a duplicate").
- **ADR 005** amended: the three-row table rewritten to match D3 and D4.
- **ADR 023** amended: the taken-username row (D3).
- **ADR 026** amended: where sign-in lands (D2). **ADR 020** gains a line: the code may pass through router state from `/activate` to the add-course page.
- `adr/README.md` and `PROJECT.md`: line 027; reworded lines 005, 023, 026.
- `STATE.md`: phase; the ADR 005 / ADR 023 item removed from open decisions.
- `ROADMAP.md`: slice 5 → done (or its "Done when" trimmed for variant B); new out-of-scope entries from section 1; "Accounts without a course" reworded, since such an account can now add a code.
- `web/DESIGN_SYSTEM.md`: header navigation.
- Move this file to `.planning/plans/done/` with a "Decisions made" block and "Changed during implementation" notes.
- If D0-C: only `ROADMAP.md` (slice 5 → cut), `STATE.md`, and a README limitation in slice 6.

## 10. Commits

```
docs(planning): plan slice 5 and record add-course decisions
feat(activation): redeem a code for the signed-in student
feat(web): add a course from the LMS, code carried through sign-in
docs(planning): close slice 5
```

## 11. Smallest viable variant (D0-B)

It still honours ADR 005's rules: a code adds a course to an existing account, a duplicate
is rejected, and the code stays valid.

**Kept**
- The whole API of section 3, including the D1 decision, M4 and every **[S]** test.
- `/lms/add-course` with an empty code field, the dashboard link, the messages of M16, the refresh of M15.

**Cut**
- Code through login: no router state, no `carried-activation-code.ts`, no change to `LoginPage`. ADR 026 and ADR 020 stay as they are; D2 and D4 are not needed.
- The activation form keeps "That username is taken. Choose another." (ADR 023 wins). It gains one static sentence: "Already have an account? Sign in, choose Add a course and paste this code." with a plain link to `/login`.
- Tests 29, 38–43; optionally 16, 19 and 22.
- With D1-B instead of D1-A: also `release`, tests 18, 23 and 27. Not recommended: it is the one place the variant would contradict ADR 005.

**Docs differ**
- ADR 005 row 2 becomes "the student signs in and enters the code in the LMS; the code is not carried".
- `ROADMAP.md` slice 5 drops "code carried through login" and gains an out-of-scope entry: "Carrying the code through sign-in — the student pastes it. Production: the link opens the right flow for whoever is signed in."

**Commits**
```
docs(planning): plan slice 5 and record add-course decisions
feat(activation): redeem a code for the signed-in student
feat(web): add a course from the LMS
docs(planning): close slice 5
```

## Changed during implementation

- **Built: variant B.** Web tests 29 and 38–43 were not written; `LoginPage` is unchanged.
- **Two second looks in the claim step.** Reviews found two narrow interleavings: a second
  tab of the same student could be told "already owned" about the enrolment its own code
  had just produced, and a student who lost the claim to a duplicate-holder was told
  "used" for a code that had been released. `CourseAdditionService.claimFor` now re-reads
  the code in the first case and retries the claim once in the second.
- **Onboarding's resume path changed with the extraction.** A claimed code whose student
  already has the course is now released when it is presented through onboarding too
  (before: an error was logged and the claim stayed). One test added for it.
- **Typed refusals.** `onboardingRefusal` and `redemptionRefusal` each accept only the
  reasons their endpoint can give.
- **`useSessionExpiry`** accepts any API error with status 401 (M17); the add-course page
  navigates from the call-site callback, so leaving the page mid-request is respected.
- **Not done:** `confirm(codeId, studentId)` (Low from `security-reviewer`; recorded in
  `STATE.md`); `buyCode` in `activation.int.spec.ts` still has its local copy.
