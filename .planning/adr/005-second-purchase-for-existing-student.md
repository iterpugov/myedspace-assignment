# 005 — An activation code adds a course to an existing student account

**Status:** accepted · **Date:** 2026-10-01

## Context
A seat carries one course (ADR 003), so a second subject for the same child is a second
order. If a purchase could only ever create a new account, that paid seat would have
nowhere to go once the student already has one.

## Decision
The purchase outcome is an activation code and a link that carries the same code — one
secret, two ways to use it. Codes are copied, not typed.

| Who opens it | What happens |
|---|---|
| New student, via the link | Onboarding form and password create the account and the enrolment |
| New student, login already taken | "That username is taken. Choose another." (ADR 023) |
| Student who already has an account | Signs in and enters the code in the LMS; the course is added to that account (ADR 027) |

Rules:
- A student can hold many enrolments, but only one per course. Redeeming a code for a
  course the student already has is rejected with "this purchase is a duplicate, contact
  your parent", and the code stays valid for another student.
- The student's identity is the account they are logged in to; nothing else is matched.
- The year lives on the enrolment and is not checked against the student's other
  enrolments.

Adding a course to an existing account is the last slice and the first to be cut if time
runs out; the data model supports it from the start.

## Alternatives considered
- Out of scope from the start — less code, but a paid seat becomes a dead end.
- Log in on the invitation page as a branch of onboarding — one operation with a fork
  instead of two simple ones.

## Consequences
- Redeeming has two operations (register with a code, add a code to my account); both are
  on the security-review list.
- If the slice is cut, the README lists it as a known limitation.

## In production
The parent would add a subject from their own account and attach it to the chosen child
directly. Duplicate purchases would be prevented at checkout or refunded.

## Notes
Amended 2026-10-02 (ADR 027): the code is not carried through sign-in and the activation
link does not detect a signed-in student; an existing student pastes the code into the
"Add a course" form in the LMS. A taken username keeps the ADR 023 wording.
