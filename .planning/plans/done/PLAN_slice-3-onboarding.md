# PLAN — Slice 3 «Onboarding»

> Produced by the `planner` subagent on 2026-10-02. The open decisions in section 2 were
> made by the user the same day; see "Decisions made".

Slice 3 replaces the `/activate` placeholder with an onboarding form and adds
`POST /api/activations`: one request redeems an activation code, creates the student
(`identity`) and the enrolment (`lms`), and sets the session cookie. The student lands on a
placeholder LMS page that is reachable only with that cookie. Three modules write in one
request, so the central question is how they stay consistent without a shared transaction
(D1).

## 1. Goal and done criteria

**Goal:** a student opens `/activate#code=<code>`, fills in the form, gets an account with
an enrolment and a session, and lands on `/lms`; the same code cannot be redeemed again.

**Requirements covered:** ONB-1, ONB-2, ONB-3, ONB-4.

| # | Criterion | Check |
|---|-----------|-------|
| 1 | The link opens onboarding | `/activate#code=<code>` shows the form with the code filled in; the fragment is gone from the address bar |
| 2 | Redeeming creates the account | `POST /api/activations` returns 201; one `Student` row with a lower-case username and a `scrypt$…` hash |
| 3 | Redeeming creates the enrolment | One `Enrolment` row with the code's `courseId`, `year` and `seatId` |
| 4 | The code works once | A second redemption returns 409 and creates nothing; two concurrent redemptions give exactly one 201 |
| 5 | Single use holds in the database | Conditional update on `ActivationCode` plus `Enrolment.seatId` unique |
| 6 | A taken username does not burn the code | 409 `username_taken`; the code row is untouched; the same code then works with a free username |
| 7 | A partial failure loses no paid seat | With `lms` failing after the claim, presenting the code again completes the enrolment for the claiming student (D1) |
| 8 | Redeeming logs the student in | The response sets an httpOnly cookie; `GET /api/session` with it returns the student |
| 9 | The LMS placeholder is behind the session | `/lms` without a valid cookie redirects to `/login`; `GET /api/session` returns 401 |
| 10 | No secrets leak | No password or plain code in any table, log line or URL; no signing secret in the repository |
| 11 | Malformed requests are rejected | Table-driven 400s; unknown properties (`studentId`, `courseId`, `year`) are 400 |
| 12 | Tests | `npm test -w api`, `npm run test:int -w api`, `npm test -w web` pass |
| 13 | Clean clone | `docker compose down -v && docker compose up --build -d --wait` exits 0 with no `.env`; `migrate` applies four migrations |
| 14 | Reviews | `typescript-reviewer`, `code-reviewer`; `security-reviewer` ends in PASS |

**Out of scope** (new entries go to `ROADMAP.md` "Out of scope" when closing):
- Login, logout, guarding LMS endpoints, dashboard, lessons (slice 4). `/login` stays a placeholder.
- Adding a code to an existing account, carrying the code through login, the
  duplicate-course message (slice 5). Slice 3 only keeps them possible.
- Rate limiting on redemption and registration (earlier decision; noted only).
- Password reset, strength meter, breached-password check, Unicode normalisation of passwords.
- Removing accounts that ended up without a course (D1 failure rows 3 and 4).
- CSRF tokens: `SameSite=Strict` plus JSON-only bodies is the whole defence here.
- The undecided "502 for a failed charge" item stays in `STATE.md`.

## 2. Open decisions

### Needs the user's call before code

**D1 — How code, student and enrolment stay consistent across three modules.**
ADR 009 says the code is "marked redeemed in the same transaction that creates the
enrolment". ADR 006 and the roadmap row for slice 3 say the same. ADR 021 later rejected a
shared transaction across modules. The wording has to be reconciled either way.

Two facts shape the options:
- "Username taken" is an expected, frequent failure, and the code must survive it.
- Under guest checkout (ADR 001) a burnt code is a paid seat nobody can re-issue. That is
  the one outcome that is not harmless.

| Option | Order of steps | Single-use gate | Verdict |
|---|---|---|---|
| A. Shared transaction (ADR 009 as written) | One `$transaction`; all three services take `tx` | Row update inside the transaction | Atomic and the least code, but it is exactly what ADR 021 rejected |
| B. Claim first, compensate | claim code → create student → enrol; release the claim on failure | Conditional `UPDATE` in `activation` | The expected failure (username taken) needs compensation; a crash after the claim burns a paid code |
| C. Identity first, enrolment is the gate | create student → enrol (`seatId` unique) → mark code | Unique `Enrolment.seatId` in `lms` | Never loses a seat and has no states, but single use is enforced outside `activation` |
| D. Identity first, claim binds, resume by code | look up code → create student → claim code for that student → enrol (idempotent) → confirm | Conditional `UPDATE` in `activation`; `Enrolment.seatId` unique as a backstop | **Recommended** |
| E. Reserve with a lease or an outbox | claim with expiry or an event; `lms` consumes | Lease or relay | The production answer; too much machinery for this slice |

Failure table for **B**:

| Failure | Left behind | Harmless? |
|---|---|---|
| Username taken | A claimed code; must be released | Only if the release succeeds |
| Crash after the claim | A claimed code, no student | **No** — paid seat lost |
| Enrol fails | Student plus claimed code | **No**, unless the release succeeds |

Failure table for **C**:

| Failure | Left behind | Harmless? |
|---|---|---|
| Username taken | Nothing | Yes |
| Crash after the student | An account without a course; the code is intact | Yes — retry with another username |
| Marking the code fails | An enrolled student; the code looks unused | Mostly — each replay creates an account before the seat constraint stops it |
| Two concurrent redemptions | One enrolment; the loser keeps an empty account | Yes |

Failure table for **D** (recommended):

| # | Failure | Left behind | Recovery |
|---|---|---|---|
| 1 | Code unknown or already claimed | Nothing | Rejected before any write |
| 2 | Username taken | Nothing; the code is untouched | Field error; the student picks another username |
| 3 | Crash after the student, before the claim | An account without a course; the code is unclaimed | Retry with another username (slice 5: log in and add the code). No seat lost |
| 4 | The claim loses a race (0 rows updated) | The loser's account without a course | 409 "code already used". Nothing compensates, as in ADR 021 |
| 5 | Enrol fails after the claim | A code claimed for student X, not confirmed; X exists | The next presentation of the code finishes X's enrolment, confirms the code and answers 409 "already used, sign in" |
| 6 | Confirm fails after enrol | Same as row 5, with the enrolment present | Same; enrol is idempotent on `seatId` |
| 7 | Cookie issue fails | A complete account | The student signs in (slice 4) |

Why D:
- The step with the expected failure runs before the irreversible one, so no compensation
  exists anywhere in slice 3.
- The gate is in `activation`, the module ADR 012 makes responsible for "redeeming once".
- A claim records who it is for, so an unfinished redemption can be resumed by anyone
  presenting the code. It always completes for the claiming student, never for the presenter.
- No failure loses a paid seat. The worst leftover is an account with no course.

Costs of D:
- Two columns on the code: `claimedByStudentId` and `redeemedAt`.
- A student can exist without an enrolment. This weakens ADR 004's "no half-existing
  students"; the slice 4 dashboard must handle zero courses.
- Recovery in row 5 ends with "sign in", which only works once slice 4 exists.

Slice 5 under D: a logged-in student skips the student step: check for a duplicate course →
claim → enrol → confirm, with a `release` only for a duplicate-course race. Not blocked.

**D2 — Check the code before showing the form, or only on submit.**

| Option | Trade-off |
|---|---|
| A. Submit only: one form with the code field prefilled from the link | One endpoint and no extra anonymous surface. The same page serves a typed code after a reload. A used code is discovered only after the form is filled in |
| B. `POST /api/activations/check` returns subject and year | The page can say "Activating Maths · Year 7" and reject a dead link at once. Adds an endpoint, `activation` → `catalogue`, a two-step page and about six tests |

Recommendation: **A**.

**D3 — Do an unknown code and a used code get the same response?**

| Option | Trade-off |
|---|---|
| A. Different: 422 `code_invalid`, 409 `code_used` | The student who reuses a link is told to sign in; a typo is told to check the code. Reveals that a code existed, but only to someone who already holds it |
| B. Same: one 422 "not valid or already used" | Reveals nothing. A student with a used link gets no hint |

Recommendation: **A**.

**D4 — What the onboarding form collects (ONB-2 says only "a basic onboarding form").**

| Option | Trade-off |
|---|---|
| A. Username and password only | Smallest; a registration form more than onboarding |
| B. Plus first name | One field; the LMS can say "Welcome, Sam"; minimal personal data about a child |
| C. Plus last name, date of birth, etc. | Personal data about children that nothing in the brief uses |

Recommendation: **B**, with a "repeat password" field in the form only.

**D5 — The signing secret: ADR 008 says "a local default in `.env.example`".**
Compose must work with no `.env`, so a default in `.env.example` alone is not enough.

| Option | Trade-off |
|---|---|
| A. A default value in `docker-compose.yml` | Follows the `POSTGRES_PASSWORD` pattern. A signing key is committed |
| B. `JWT_SECRET` optional; when unset the API generates a random secret at start and logs a warning; when set it must be at least 32 characters | Nothing committed can sign a token; the clean clone still works. Sessions end when the API restarts |
| C. Required variable; the API refuses to start without it | Strictest, but breaks `docker compose up` from a clean clone |

Recommendation: **B**, with a one-line amendment to ADR 008.

**D6 — Libraries for the token and the cookie.**

| Option | Trade-off |
|---|---|
| A. `@nestjs/jwt` and `cookie-parser` | The NestJS-documented path; two runtime dependencies |
| B. `jose`, cookie header parsed by hand | One modern dependency; not the Nest default |
| C. Hand-rolled HS256 with `node:crypto` | No dependency; home-made token code on the critical path |

Recommendation: **A**, with the algorithm pinned to HS256 on both sign and verify.

### Defaults taken

| # | Detail | Default | Why |
|---|---|---|---|
| M1 | Where the endpoint lives | `activation` owns `POST /api/activations` and orchestrates `identity` and `lms` | ADR 012; dependencies run `checkout → activation → {identity, lms}` with no cycle |
| M2 | Logged in after redeeming | Yes | ADR 008; the roadmap's done criterion |
| M3 | Session code in slice 3 | Sign, verify, cookie write, `SessionGuard`, `GET /api/session` | The cookie is only proven if something verifies it. Slice 4 keeps login, logout and LMS routes |
| M4 | Status codes | 201; 400 shape; 422 `code_invalid`; 409 `code_used`; 409 `username_taken` | ADR 018; the 409s are told apart by a `reason` field |
| M5 | Code input | Normalised in the DTO, then matched against `^[A-HJ-NP-Z2-9]{15}$`; raw input over 64 characters fails | Shape and length are checked before hashing |
| M6 | Username rules | Trimmed and lower-cased, 3–20 characters of `a–z`, `0–9`, `_`; unique index | Case-insensitive uniqueness with a plain index |
| M7 | Username taken | Detected by the unique constraint, not by a prior read | Race-safe |
| M8 | Password rules | 8–128 characters, no composition rules, not trimmed | Length is what matters; the cap bounds hashing work |
| M9 | First name | Trimmed, 1–50, no control characters | Same rule as `parentName` |
| M10 | scrypt | `crypto.scrypt` (async), N=32768, r=8, p=3, 16-byte salt, 64-byte key, `maxmem` 64 MiB | An OWASP-listed configuration |
| M11 | Hash storage | `scrypt$N=32768,r=8,p=3$<salt b64>$<hash b64>`; verified with `timingSafeEqual` | Parameters travel with the hash |
| M12 | Hashing cost and abuse | The password is hashed only after the code lookup succeeds | A request without a valid unclaimed code never reaches scrypt |
| M13 | Token | HS256; claims `sub`, `iat`, `exp`; 4 hours | ADR 008 |
| M14 | Cookie | `mes_session`; `HttpOnly`; `SameSite=Strict`; `Path=/api`; `Max-Age` 4 h; `Secure` only when `COOKIE_SECURE=true` | Compose serves plain http on localhost |
| M15 | `GET /api/session` | The guard verifies the token without the database; the handler reads the student; a missing student is 401 | Keeps the guard as ADR 008 describes it |
| M16 | Caching | `Cache-Control: no-store` on both endpoints | As on `POST /api/orders` |
| M17 | Logging | "Activation code redeemed for student <id>"; never the code, the password or the hash | ADR 020 |
| M18 | Foreign keys | `Enrolment` → `Student` and → `Course`; `ActivationCode` stays without foreign keys | Slice 2's rule |
| M19 | Idempotent enrol | Upsert on `seatId` with an empty update; a row owned by another student is an error | Makes D1 rows 5 and 6 safe |
| M20 | Domain errors | `identity` and `lms` throw plain error classes; only `activation` maps them to HTTP | Public services stay transport-neutral |
| M21 | Removing `#code=` | The page reads `location.hash` once into state, then navigates with `replace` to the same path without the hash | Testable under `MemoryRouter` |
| M22 | After a reload | The code field is empty and editable | The code is deliberately not stored anywhere (ADR 020) |
| M23 | Form | React Hook Form; fields: activation code, first name, username, password, repeat password | ADR 014 |
| M24 | Client state | The mutation uses `gcTime: 0`; on 201 the response is put under the `['session']` query and the page navigates to `/lms` with `replace` | Neither the password nor the code stays in the cache |
| M25 | `/lms` in this slice | Placeholder: "Welcome, <first name>"; 401 redirects to `/login` | The roadmap asks only for a page behind the session |
| M26 | `Field` | Gains an optional `hint`, like `Select` | The username rule has to be shown before an error |
| M27 | Rate limiting | None | Already out of scope |

### Decisions made (2026-10-02)

Changed during implementation: M19 — `enrol` creates the row and, on a unique violation,
looks the seat up to tell which constraint refused it (no upsert). `@nestjs/jwt` is 11, not
12, because 12 is ES modules only.

The user accepted every recommendation: D1 → D (ADR 022); D2 → A, D3 → A, D4 → B (ADR 023);
D5 → B, D6 → A (ADR 024).

## 3. Design

Assumes D1-D, D2-A, D3-A, D4-B, D5-B, D6-A.

### Prisma (one migration, `add_student_enrolment_and_code_redemption`)

```prisma
/// Owned by the identity module.
model Student {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  /// Stored lower-case, so the unique index is case-insensitive.
  username     String   @unique
  firstName    String
  passwordHash String
  createdAt    DateTime @default(now()) @db.Timestamptz(3)
  enrolments   Enrolment[]
}

/// Owned by the lms module.
model Enrolment {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  studentId String   @db.Uuid
  student   Student  @relation(fields: [studentId], references: [id])
  courseId  String   @db.Uuid
  course    Course   @relation(fields: [courseId], references: [id])
  year      Int
  /// One enrolment per paid seat (ADR 009). No foreign key: the seat is checkout's.
  seatId    String   @unique @db.Uuid
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  @@unique([studentId, courseId]) // one enrolment per course (ADR 005)
}

model ActivationCode {
  // existing columns unchanged
  /// Set once by a conditional update: the single-use gate.
  claimedByStudentId String?   @db.Uuid
  /// Set after the enrolment exists. Claimed but not redeemed = to be resumed.
  redeemedAt         DateTime? @db.Timestamptz(3)
}
```

### Contract (`packages/contracts/src/index.ts`)

```ts
export interface ActivationRequest {
  code: string;
  firstName: string;
  username: string;
  password: string;
}

/** The signed-in student; returned by POST /api/activations and GET /api/session. */
export interface StudentResponse {
  id: string;
  username: string;
  firstName: string;
}

export type ActivationFailureReason = 'code_invalid' | 'code_used' | 'username_taken';

export interface ActivationErrorResponse {
  statusCode: number;
  message: string;
  reason: ActivationFailureReason;
}
```

### Endpoints

`POST /api/activations`, body `ActivationRequest`.

| Status | When | Body |
|---|---|---|
| 201 | Account, enrolment and session created | `StudentResponse` plus `Set-Cookie` |
| 400 | Shape validation fails or an unknown property is sent | Nest default |
| 422 | No such code | `reason: 'code_invalid'` |
| 409 | The code is already claimed | `reason: 'code_used'` |
| 409 | The username exists | `reason: 'username_taken'` |

`GET /api/session` returns 200 with `StudentResponse`, or 401 with no valid cookie.

Flow of `OnboardingService.onboard()` in `activation`:
1. Look up the code by hash. None → 422.
2. If the code is claimed: when `redeemedAt` is null, finish it for the claiming student
   (enrol, confirm). Then answer 409 `code_used`.
3. `IdentityService.register()`. `UsernameTakenError` → 409 `username_taken`.
4. `ActivationService.claim(codeId, studentId)`: update where `claimedByStudentId` is null.
   Zero rows → 409 `code_used`.
5. `EnrolmentService.enrol({ studentId, courseId, year, seatId })`.
6. `ActivationService.confirm(codeId)` sets `redeemedAt`.
7. The controller calls `SessionService.start(res, studentId)` and returns the student.

### Module public surfaces

| Module | Exports | Slice 3 members |
|---|---|---|
| `identity` | `IdentityService` | `register({ username, password, firstName })`; `findById(id)`; throws `UsernameTakenError` |
| `identity` | `SessionService` | `start(res, studentId)`; `verify(token)` |
| `identity` | `SessionGuard`, credential rule constants | The guard reads the cookie and sets the student id on the request |
| `lms` | `EnrolmentService` | `enrol({ studentId, courseId, year, seatId })`; throws `SeatAlreadyEnrolledError`, `AlreadyEnrolledInCourseError` |
| `activation` | `ActivationService` | `issue()` unchanged; `findByCode`, `claim`, `confirm` used by `OnboardingService` |

### Web

| Route | Page | Behaviour |
|---|---|---|
| `/activate` | `ActivatePage` | Form per M23; errors mapped by `reason`; on 201 goes to `/lms` |
| `/lms` | `LmsPage` | Asks `GET /api/session`; 401 → `/login`; otherwise the welcome placeholder |
| `/login` | unchanged placeholder | Slice 4 |

Error mapping on `ActivatePage`:
- `username_taken`: under the username field, "That username is taken. Choose another."
- `code_invalid`: under the code field, "This activation code is not valid. Check it and try again."
- `code_used`: error notice "This code has already been used." with a "Sign in" link.
- 400: notice "Check the details and try again."
- Anything else: notice "We could not create your account. Please try again."

## 4. File scope

```
packages/contracts/src/index.ts                       add ActivationRequest, StudentResponse, error types

api/package.json                                      @nestjs/jwt, cookie-parser, @types/cookie-parser (D6)
api/prisma/schema.prisma                              Student, Enrolment, two columns on ActivationCode
api/prisma/migrations/<ts>_add_student_enrolment_and_code_redemption/migration.sql
api/src/app.setup.ts                                  cookie parser
api/src/app.module.ts                                 import IdentityModule, LmsModule

api/src/identity/identity.module.ts                   new
api/src/identity/identity.service.ts                  new: register, findById
api/src/identity/password.ts (+ spec)                 new: hashPassword, verifyPassword
api/src/identity/credential-rules.ts (+ spec)         new: username and password rules
api/src/identity/session-secret.ts (+ spec)           new: resolve JWT_SECRET (D5)
api/src/identity/session.service.ts                   new: start, verify
api/src/identity/session.guard.ts                     new
api/src/identity/session.controller.ts                new: GET /api/session
api/src/identity/session.int.spec.ts                  new

api/src/lms/lms.module.ts                             new
api/src/lms/enrolment.service.ts                      new: enrol
api/src/lms/enrolment.int.spec.ts                     new

api/src/activation/activation-code.ts (+ spec)        add the well-formedness check
api/src/activation/activation.service.ts              add findByCode, claim, confirm
api/src/activation/onboarding.service.ts              new: the flow above
api/src/activation/activation.controller.ts           new: POST /api/activations
api/src/activation/dto/activation-request.dto.ts      new
api/src/activation/activation.module.ts               import IdentityModule, LmsModule; controller
api/src/activation/activation.int.spec.ts             new

docker-compose.yml                                    JWT_SECRET and COOKIE_SECURE passed to api (D5)
.env.example                                          commented JWT_SECRET, COOKIE_SECURE

web/src/App.tsx                                       /activate → ActivatePage, /lms → LmsPage
web/src/api/activations.ts                            new: activate(), ActivationError with reason
web/src/api/session.ts                                new: fetchSession()
web/src/activation-code-from-hash.ts (+ test)         new: read the code from a fragment
web/src/pages/ActivatePage.tsx (+ test)               new
web/src/pages/LmsPage.tsx (+ test)                    new
web/src/ui/Field.tsx                                  optional hint
web/DESIGN_SYSTEM.md                                  Field hint; build-status line
```

## 5. Tests for `tdd-guide` (RED before code)

### API unit — `api/src/identity/password.spec.ts`
1. `hashPassword()` returns `scrypt$N=32768,r=8,p=3$<salt>$<hash>` and does not contain the password.
2. The same password hashed twice gives two different strings.
3. `verifyPassword()` is true for the right password and false for a wrong one.
4. `verifyPassword()` returns false, without throwing, for a malformed stored value.
5. A stored hash made with other parameters (fixture with N=16384) still verifies.

### API unit — `api/src/identity/credential-rules.spec.ts`
6. `normaliseUsername()` trims and lower-cases.
7. Table: accepted usernames (`sam`, `sam_07`, 20 characters) and rejected ones (2 and 21
   characters, a space, `@`, a hyphen, a non-ASCII letter).

### API unit — `api/src/activation/activation-code.spec.ts` (additions)
8. A hyphenated, a lower-case and an un-hyphenated code are all well-formed.
9. 14 or 16 symbols, or any of `I`, `O`, `0`, `1`, are not well-formed.
10. A non-string and an input longer than 64 characters are not well-formed.

### API unit — `api/src/identity/session-secret.spec.ts` (D5-B)
11. A configured secret of 32 or more characters is returned as is.
12. A configured secret shorter than 32 characters throws.
13. With no secret configured, a random one of at least 32 bytes is returned.
14. Two calls with no secret configured return different values.

### API integration — `api/src/activation/activation.int.spec.ts`
`beforeEach`: reset, seed courses. A helper buys a code through `POST /api/orders`.

15. A valid request returns 201 with exactly `id`, `username`, `firstName`, and `Cache-Control: no-store`.
16. The response sets `mes_session` with `HttpOnly`, `SameSite=Strict`, `Path=/api` and a `Max-Age`.
17. One `Student` row: lower-case username, `passwordHash` starting with `scrypt$`; no column of any table contains the password or the plain code.
18. One `Enrolment` row with the code's `courseId`, `year` and `seatId`; the code row has `claimedByStudentId` = the student and `redeemedAt` set.
19. A second redemption with another username returns 409 `code_used`, no cookie, no new student, no new enrolment.
20. A well-formed unknown code returns 422 `code_invalid` and stores nothing.
21. Two concurrent redemptions with different usernames: exactly one 201 and one 409; one enrolment; the code is claimed by the 201's student.
22. A taken username returns 409 `username_taken` with no cookie; the code row is unclaimed; the same code with a free username then returns 201.
23. A username differing only in case returns 409 `username_taken`.
24. The code is accepted in lower case without hyphens.
25. Two codes redeemed by two students give two students and two enrolments.
26. Table-driven 400s, each storing nothing and setting no cookie.
27. Extra properties `studentId`, `courseId`, `year` each return 400.
28. With `EnrolmentService.enrol` failing: 5xx and no cookie; the student exists; the code is claimed with `redeemedAt` null. The code is then presented to a healthy app with another username: 409 `code_used`; the enrolment now exists for the first student; `redeemedAt` is set; there is still exactly one student.
29. With `IdentityService.register` failing with an unexpected error: 5xx; the code is unclaimed; nothing is stored.

### API integration — `api/src/identity/session.int.spec.ts`
30. The cookie from a 201 authenticates `GET /api/session`: 200 with the same student.
31. No cookie → 401.
32. A garbage cookie value → 401.
33. A token signed with a different secret → 401.
34. An expired token → 401.
35. A token with `alg: none` → 401.
36. A valid token for a student that no longer exists → 401.

### API integration — `api/src/lms/enrolment.int.spec.ts`
37. `enrol()` creates one row.
38. The same call twice leaves one row and does not throw.
39. The same seat for a different student throws `SeatAlreadyEnrolledError`.
40. A second seat for the same student and course throws `AlreadyEnrolledInCourseError` (ADR 005).

### Web — `web/src/activation-code-from-hash.test.ts`
41. `#code=ABCDE-FGHJK-MNPQR` gives the code.
42. An empty fragment, a fragment without `code`, and an over-long value give an empty string.

### Web — `web/src/pages/ActivatePage.test.tsx`
43. Opened with `#code=<code>`: the code field holds the code, and the location no longer has a fragment.
44. Opened without a fragment: the form is shown with an empty code field.
45. An empty submit shows a required error under each field and sends no request.
46. A username with an illegal character, a 7-character password, and two different passwords each show an error and send no request.
47. A valid submit sends `POST /api/activations` with `code`, trimmed `firstName`, lower-cased `username` and `password`, and nothing else.
48. After 201 the student is on `/lms` and sees the welcome with their first name.
49. 409 `username_taken` shows the error under the username; values are kept; the button is enabled.
50. 422 `code_invalid` shows the error under the code field.
51. 409 `code_used` shows an alert and a "Sign in" link to `/login`.
52. A 500 shows the generic alert and keeps the values.
53. The button is disabled while the request is pending.

### Web — `web/src/pages/LmsPage.test.tsx`
54. `GET /api/session` 200 shows "Welcome, <first name>".
55. 401 redirects to `/login`.

## 6. Ordered tasks

| # | Step | Agent / pipeline |
|---|---|---|
| 1 | User decides D1–D6; ADRs, amendments, `PROJECT.md`, `STATE.md` | — |
| 2 | Dependencies, contract types, compose and `.env.example` | simplified |
| 3 | RED: tests 1–40 (API) | `tdd-guide` |
| 4 | Schema and migration; `identity`, `lms`, `activation` → GREEN | parent |
| 5 | RED: tests 41–55 (web) | `tdd-guide` |
| 6 | `Field` hint, API clients, pages, routes → GREEN | parent |
| 7 | One review over API and web | `typescript-reviewer` |
| 8 | Full slice diff | `code-reviewer` |
| 9 | **[CRITICAL]** redemption, credentials, session | `security-reviewer`, must end in PASS |
| 10 | Verification, commits, close the slice | parent |

Focus for `security-reviewer`: the single-use gate under concurrency and the resume path
(it must only ever enrol the claiming student); scrypt parameters, salt, constant-time
comparison; token algorithm pinning, expiry and secret handling; cookie attributes; mass
assignment on `POST /api/activations`; no code, password or hash in logs, URLs, the query
cache or error bodies; fragment removal; what "username taken" and D3 reveal.

## 7. Risks

- **Prisma unique-violation details with the pg driver adapter.** `meta.target` may not
  name the constraint. `Student` has one unique column, so `P2002` means "username taken".
- **Secret read too early.** The JWT module must read the secret in a factory at boot.
- **scrypt memory limit.** N=32768, r=8 sits at Node's default `maxmem`; raise it explicitly.
- **Concurrency test flakiness.** Test 21 asserts outcomes that hold in any interleaving.
- **StrictMode double effects.** Read the code into state before the fragment is removed.
- **Password fields have no `textbox` role.** Web tests query them by label.
- **Lock file.** New dependencies must not drop the Linux bindings.
- **Recovery text before slice 4.** "Sign in" leads to a placeholder until the next slice.

## 8. Verification

```
docker compose down -v
docker compose up --build -d --wait
ID=$(curl -s localhost:8080/api/courses | node -pe "JSON.parse(require('fs').readFileSync(0)).find(c=>c.subject==='Maths').id")
CODE=$(curl -s -X POST localhost:8080/api/orders -H 'content-type: application/json' \
  -d "{\"parentName\":\"Pat\",\"parentEmail\":\"pat@example.com\",\"seats\":[{\"courseId\":\"$ID\",\"year\":7}]}" \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).seats[0].activationCode")
curl -s -i -c jar -X POST localhost:8080/api/activations -H 'content-type: application/json' \
  -d "{\"code\":\"$CODE\",\"firstName\":\"Sam\",\"username\":\"sam\",\"password\":\"<test password>\"}"
curl -s -i -b jar localhost:8080/api/session
curl -s -i localhost:8080/api/session
docker compose exec db psql -U mes -d mes -c 'select username, left("passwordHash", 24) from "Student"'
docker compose exec db psql -U mes -d mes -c 'select count(*) from "Enrolment"'
git grep -n -i 'jwt_secret' -- . ':!.planning'
npm test -w api && npm run test:int -w api && npm test -w web
```

Expected: four migrations; 201 with the cookie; 200 with the student; 401 without the
cookie; 409 `code_used` on a second redemption; one student with a `scrypt$…` hash; one
enrolment; no code or password in the API log; `JWT_SECRET` has no value in the repository.

By hand: buy Maths / Year 7, open the activation link, check the address shows `/activate`
with no fragment and the code filled in, submit empty, create the account, land on `/lms`,
reload and stay in, reuse the link and see "already used", open `/lms` in a private window
and get redirected to `/login`.

## 9. Commits

```
docs(planning): plan slice 3 and record onboarding decisions
feat(identity): register students with scrypt and a session cookie
feat(activation): redeem a code into an account and an enrolment
feat(web): onboarding form and LMS placeholder behind the session
docs(planning): close slice 3
```
