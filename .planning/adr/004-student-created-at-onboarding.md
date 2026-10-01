# 004 — The student record is created at onboarding

**Status:** accepted · **Date:** 2026-10-01

## Context
The parent buys, the student onboards later. The system could create the student when the
order is placed or when the invitation is redeemed. The live MyEdSpace checkout keeps
students anonymous at purchase ("Student 1").

## Decision
An order holds only the parent's details and anonymous seats. The student and their
enrolment (student, course, year) are created together when the activation code is
redeemed.

The brief says the student "activates their account". We read activation as registering
with a valid activation code; no account exists before that.

## Alternatives considered
- Create a pending student at purchase from details the parent enters — introduces
  inactive, password-less records and makes the parent type what the student types anyway.

## Consequences
- No half-existing students: a student row always has credentials and an enrolment.
- Until onboarding the system does not know who a seat is for.
- The activation code is the only link between a paid seat and its future student.

## In production
The same shape, plus reminders for unredeemed invitations and a way for the parent to
re-send them.
