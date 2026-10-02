# 022 — Redeeming a code: the student first, then a claim that binds the code to them

**Status:** accepted · **Date:** 2026-10-02

## Context
Redeeming an activation code writes in three modules: `identity` creates the student,
`activation` marks the code used, `lms` creates the enrolment (ADR 012). ADR 009 said this
happens in one transaction; ADR 021 later decided that modules do not share transactions.

Two facts shape the order of steps. "Username taken" is an expected failure, and the code
must survive it. And under guest checkout (ADR 001) a burnt code is a paid seat that nobody
can re-issue — the one outcome that is not harmless.

## Decision
Each module writes in its own transaction, in this order:

1. `activation` looks the code up. Unknown → rejected; already claimed → see "Resume".
2. `identity` creates the student. A taken username stops here; the code is untouched.
3. `activation` claims the code **for that student** with a conditional update
   (`… WHERE claimedByStudentId IS NULL`). This is the single-use gate: of two concurrent
   redemptions exactly one updates a row.
4. `lms` creates the enrolment. The call is idempotent per seat.
5. `activation` marks the code redeemed.

**Resume.** A code that is claimed but not redeemed is an interrupted redemption. Whoever
presents it next triggers steps 4 and 5 for the student recorded in the claim — never for
the presenter — and is then told the code is already used.

| Failure | Left behind | Outcome |
|---|---|---|
| Username taken | Nothing | The student picks another username |
| Crash after the student, before the claim | An account without a course | The code still works with another username |
| The claim loses a race | The loser's account without a course | "Code already used" |
| Enrolment or confirmation fails after the claim | A claimed, unconfirmed code | Finished on the next presentation of the code |

## Alternatives considered
- One shared transaction — atomic and the least code; rejected for the reason in ADR 021.
- Claim the code first, then create the student — the expected failure (username taken)
  would need a compensating release, and a crash after the claim burns a paid code.
- Student first, with the unique enrolment per seat as the only gate — loses no seat and
  needs no state, but single use is then enforced outside `activation`.
- A claim with an expiry, or an outbox with `lms` as a consumer — the production answer;
  too much machinery here.

## Consequences
- No step needs compensation, and no failure loses a paid seat.
- An account can exist without an enrolment. This relaxes ADR 004; the LMS must handle a
  student with no courses.
- The code row gains `claimedByStudentId` and `redeemedAt`.
- One enrolment per seat is also a database constraint, as a backstop.
- `Enrolment` keeps foreign keys to `Student` and `Course` while all three live in one
  database; the code row has none. Split into services, those keys would go.

## In production
The claim would carry a lease, the enrolment would be driven by an outbox event with an
idempotent consumer, and accounts left without a course would be cleaned up or offered a
way to add a code.

## Notes
Amended 2026-10-02 (ADR 027): a claim can be released, by a conditional update, when the
enrolment is refused because the student already has the course. A redeemed code is never
released.
