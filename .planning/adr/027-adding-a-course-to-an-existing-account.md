# 027 — Adding a course: check for a duplicate, claim, enrol; release the claim on a late duplicate

**Status:** accepted · **Date:** 2026-10-02

## Context
ADR 005 lets a signed-in student redeem a second code, and says a code for a course the
student already has is rejected and stays valid for someone else. ADR 022 redeems by
claiming the code first and enrolling second, each module in its own transaction. Claiming
first and then finding a duplicate would leave a paid code bound to a student who can never
get its enrolment.

## Decision
`POST /api/redemptions` `{ code }`, behind the session guard, adds the code's course to the
signed-in student. It lives in `activation`, which already depends on `identity` and `lms`.

1. The student in the token must still exist, else 401.
2. Unknown code: 422 `code_invalid`.
3. A code claimed by another student: their unfinished redemption is completed if it can
   be, and the answer is 409 `code_used`.
4. A code that is not claimed: `lms` is asked whether the student has the course. If so,
   409 `course_already_owned` and the code is not touched. Otherwise the code is claimed by
   the conditional update of ADR 022.
5. A code claimed by the caller: enrol (idempotent per seat), confirm, 200
   `{ courseId, year }`. Presenting one's own redeemed code again answers the same 200.
6. If the enrolment is refused as a duplicate after the claim, the claim is released by a
   conditional update (`claimed by this student and not redeemed`), and the answer is 409
   `course_already_owned`.

The duplicate check in step 4 is a read in one module followed by a write in another, so it
can be stale: the same student redeeming two codes for one course at the same moment passes
it twice. The unique index on `(student, course)` in `lms` is the real rule; step 6 is the
compensation for that gap, and it also runs when a claimed code is presented again.

The SPA has a code form at `/lms/add-course`. The code is not carried from the activation
link through sign-in: the student pastes it. The activation form keeps "That username is
taken. Choose another." (ADR 023) and gains a sentence pointing an existing student to
sign in and add the course there.

## Alternatives considered
- No release — less code, but the same-moment double redemption would burn a paid code,
  against ADR 005.
- Claim first, release on every duplicate — no stale check, but the expected failure would
  need compensation, and a crash between claim and release holds the code until it is
  presented again. ADR 022 rejected this shape for a taken username.
- Enrol first, claim second — the index rejects a duplicate atomically, but a lost claim
  leaves an enrolment on a seat whose code belongs to someone else.
- One transaction over the code and the enrolment — simplest, and not available once the
  modules are services.
- Carrying the code through sign-in in router state — fewer steps for the student, but it
  changes where sign-in lands (ADR 026) for a flow the brief does not ask for.

## Consequences
- A claim is no longer strictly "set once": it can be undone, but only while no enrolment
  uses the seat. A redeemed code can never be released.
- No failure or race leaves an unredeemed code bound for good to a student who cannot be
  enrolled: after a crash between the refused enrolment and the release, the claim is
  released the next time anyone presents the code.
- Whoever presents a code in the request that releases someone else's claim is still told
  `code_used`; the code is free on their next attempt.
- A token of a student who no longer exists cannot claim a code.
- An account left without a course by an interrupted onboarding can now add a code.
- At a shared browser a course can be added to whichever account is signed in; the page
  names the account, and there is no undo.

## In production
The parent would attach a purchase to a child in their own account. Between services the
claim would carry a lease, and a worker would finish or release interrupted redemptions
instead of waiting for the code to be presented again.
