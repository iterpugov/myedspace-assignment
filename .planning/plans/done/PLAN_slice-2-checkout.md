# PLAN — Slice 2 «Checkout and activation code»

> Produced by the `planner` subagent on 2026-10-02. The open decisions in section 2 were
> made by the user the same day; see "Decisions made".

Slice 2 adds `POST /api/orders`: one request validates the seats against the catalogue,
charges a mock payment gateway, stores a paid order with its seats, and has the
`activation` module issue one activation code per seat. The SPA replaces the `/checkout`
placeholder with a parent-details form and shows the code and the activation link after
payment.

## 1. Goal and done criteria

**Goal:** the parent enters name and email on `/checkout`, pays, and sees the activation
code and link; the server rejects any seat whose year is outside the course's range.

**Requirements covered:** PUR-3, PUR-4.

| # | Criterion | Check |
|---|-----------|-------|
| 1 | Checkout creates a paid order | `POST /api/orders` with one valid seat returns 201 with `orderId`, `totalPence` 19900 and one seat carrying `activationCode` |
| 2 | Code has the agreed shape | Matches `^[A-HJ-NP-Z2-9]{5}(-[A-HJ-NP-Z2-9]{5}){2}$` (ADR 009) |
| 3 | Code is stored only as a hash | `ActivationCode.codeHash` equals SHA-256 of the normalised code; no row of any table contains the plaintext |
| 4 | Year outside the range is rejected | Science / Year 12 returns 4xx and no `Order`, `OrderSeat` or `ActivationCode` row is written |
| 5 | Many seats work in the API | Two seats return two distinct codes and a total of 39800; a request with one bad seat writes nothing |
| 6 | Price is the server's | The request has no price field; total is computed from the catalogue |
| 7 | Malformed requests are rejected | Missing or blank name, invalid email, empty `seats`, non-UUID `courseId`, non-integer `year` return 400 |
| 8 | UI flow | `/checkout?courseId=…&year=…` shows the summary and form; after "Pay" the code and the link are visible |
| 9 | Broken hand-off is handled | `/checkout` with a missing, unknown or out-of-range selection shows a notice and a link back, no form |
| 10 | No student yet | No account is created at purchase (ADR 004) |
| 11 | Tests | `npm test -w api`, `npm run test:int -w api`, `npm test -w web` pass |
| 12 | Clean clone | `docker compose down -v && docker compose up --build -d --wait` exits 0; `migrate` applies three migrations |
| 13 | Security review | `security-reviewer` ends in PASS |

**Out of scope** (not built; new entries go to `ROADMAP.md` "Out of scope" when closing):
- Redeeming a code, the `/activate` page, student and enrolment (slice 3). Only a
  placeholder route is added so the link is not a 404.
- Declined payments, order statuses, card fields (ADR 010).
- Idempotency key against double submission; the UI only disables the button while the
  request is pending.
- Several seats in the UI (ADR 003).
- Email delivery; re-showing or re-issuing a code; `GET /api/orders/:id`.
- Rate limiting on checkout; duplicate-purchase detection (ADR 005).
- `Steps` component and a progress indicator; `outline` button.

## 2. Open decisions

### Needs the user's call before code

**D1 — API request validation mechanism (carried from STATE.md).**

| Option | Trade-off |
|---|---|
| A. `class-validator` + `class-transformer` with a global `ValidationPipe` in `configureApp` | The NestJS-documented path. DTO classes `implements` the contract types, which is what ADR 011 describes, so drift fails to compile. Two runtime dependencies and decorator boilerplate; nested arrays need `@ValidateNested` + `@Type`, which is easy to forget and fails open. |
| B. `zod` with a ~15-line pipe; schemas live in `api/`, checked against contracts with `satisfies z.ZodType<CheckoutRequest>` | One dependency, schemas read well, nested arrays are natural. Not the Nest default; ADR 011's wording needs a one-line amendment. Schemas cannot move to `contracts` (types-only). |
| C. Hand-written validation functions | No dependency. More code and tests per endpoint, repeated in slices 3 and 4. |

Recommendation: **A**, with `whitelist: true`, `forbidNonWhitelisted: true`.

**D2 — How one database transaction crosses the `checkout` → `activation` boundary.**
A paid order without a code is a dead seat under guest checkout (ADR 001), so order, seats
and codes should commit together. ADR 012 says modules talk through public services and do
not touch each other's tables. Slice 3 meets the same question.

| Option | Trade-off |
|---|---|
| A. Public service methods that take part in a caller's transaction accept a `Prisma.TransactionClient`: `ActivationService.issue(tx, seats)` | Atomic, table ownership intact, same pattern serves slice 3. The transaction handle is visible in a module's public API. |
| B. Two steps: `checkout` commits the order, then calls `activation.issue()` in its own transaction | Cleanest boundary. A failure between the steps leaves a paid order with no code and needs compensation. |
| C. `checkout` writes the `ActivationCode` rows itself, using pure helpers from `activation` | Simplest code. Breaks the ownership call in ADR 012. |

Recommendation: **A**.

**D3 — What an activation code row knows about the purchase.**

| Option | Trade-off |
|---|---|
| A. The code row stores only `seatId`; in slice 3 `activation` asks `CheckoutService` for the seat | No duplicated data. Creates a module cycle (`forwardRef`). |
| B. The code row is a self-contained entitlement: `seatId`, `courseId`, `year` copied at issue | No cycle. Two duplicated columns; safe because a seat is immutable. |

Recommendation: **B**.

**D4 — How the confirmation page gets the code.**
The plaintext exists only in the checkout response (ADR 009).

| Option | Trade-off |
|---|---|
| A. No navigation: `CheckoutPage` renders the confirmation from the mutation result | Least code. The code disappears on reload, and reloading shows the form again. |
| B. Navigate with `replace` to `/checkout/confirmation`, passing the response in router `state` | Own URL, Back does not return to the form, state survives a reload in the same tab. A direct open shows "nothing to show". One more route and page. |
| C. Put the code in the confirmation URL | Survives everything, but the secret lands in history and nginx access logs. |
| D. `sessionStorage` | Survives reload; the secret sits in storage readable by any script. |

Recommendation: **B**. Either way the page says "Save this code now — it cannot be shown again".

**D5 — Logging the invitation: ADR 001 and ADR 009 pull in different directions.**
ADR 001 says the access path is written to the API log as a stand-in for the email.
ADR 009 says only the hash is stored and the code is returned once.

| Option | Trade-off |
|---|---|
| A. Log it, as ADR 001 says | Visible stand-in for the email; every unredeemed code sits in `docker compose logs`. |
| B. Do not log the code; log only "order <id> paid, <n> code(s) issued"; amend ADR 001 by one line | Consistent with ADR 009. The "email" stand-in is the confirmation page only. |

Recommendation: **B**.

### Defaults taken

> **Superseded in part by ADR 021** (see "Decisions made"): M6 and M16 changed — there is no shared transaction,
> `issue()` takes no `tx`, seat ids come from `checkout`, and `ActivationCode` has no foreign keys.

| # | Detail | Default | Why |
|---|---|---|---|
| M1 | Endpoint | `POST /api/orders` → 201 | A resource is created; payment is part of creating it (ADR 010). |
| M2 | Status codes | 400 malformed body; 422 unknown course or year outside range; Nest's default error body | Separates "bad shape" from "valid shape, breaks a rule". |
| M3 | Limits | `seats` 1–10; `parentName` trimmed, 1–100; `parentEmail` valid, ≤ 254; `year` integer | Bounds the work one anonymous request can cause. |
| M4 | Price | Never in the request; seat stores a `pricePence` snapshot, order stores `totalPence` | Server never trusts the client (ADR 017). |
| M5 | Order status | No status column; `paymentReference` stored | An order is never unpaid (ADR 010). |
| M6 | Order of work | Validate → `gateway.charge()` → one DB transaction | No transaction held open across a payment call. |
| M7 | Gateway shape | `PaymentGateway.charge({ amountPence, description }): Promise<{ reference }>`, token `PAYMENT_GATEWAY`; `MockPaymentGateway` returns `mock_<uuid>` | Shows the seam; no declined branch (ADR 010). |
| M8 | Alphabet | `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | 32 symbols, 75 bits (ADR 009). |
| M9 | Randomness | `crypto.randomBytes(15)`, each byte `& 31` | 256 is a multiple of 32, so no modulo bias. |
| M10 | Hash | SHA-256 hex of the normalised code (upper-case, hyphens and whitespace removed); `codeHash` unique | ADR 009. |
| M11 | Who builds the link | The API returns only `activationCode`; the SPA builds `${origin}/activate#code=<code>` | The API does not know its public origin. |
| M12 | Code in the fragment | `#code=` | A fragment is not sent to nginx, so the secret stays out of access logs and `Referer`. |
| M13 | `/activate` route now | `PlaceholderPage` | The link shown in this slice must not be a 404. |
| M14 | Year check | Pure `courseCoversYear(course, year)` in `catalogue`, unit-tested | The range is the catalogue's data. |
| M15 | Catalogue lookup | `CatalogueService.findCoursesByIds(ids)` | `checkout` must not read the `Course` table (ADR 012). |
| M16 | Foreign keys across modules | DB constraints; services never `include` across a module | Integrity is the database's job; ownership is about code. |
| M17 | DB reset helper | `resetDatabase(prisma)`: `TRUNCATE … RESTART IDENTITY CASCADE` over every public table except `_prisma_migrations`; each spec re-seeds in `beforeEach` | Later slices need no edits to the helper. |
| M18 | Form validation in the SPA | React Hook Form built-in rules, no resolver library | Two fields. |
| M19 | Checkout summary | `CheckoutPage` reuses the `['courses']` query | No new endpoint; the server re-validates anyway. |
| M20 | New UI primitives | `Field` and `Card` | Both are already in `DESIGN_SYSTEM.md`. |
| M21 | Copy button | "Copy link" with `navigator.clipboard`; first thing to cut | Selectable text is enough. |

### Decisions made (2026-10-02)

- D1 → A (ADR 018). D3 → B (ADR 019). D4 → B and D5 → B (ADR 020).
- D2 → none of the three: the user chose separate transactions with the codes issued
  **before** the order (ADR 021). Flow: validate → `ActivationService.issue(seats)` →
  `gateway.charge()` → save order and seats. `checkout` generates seat ids;
  `ActivationCode.seatId` has no foreign key. Section 3 below still shows the planner's
  original shared-transaction design.
- Added test: when the gateway throws, no order or seat is stored and the response carries
  no code.

## 3. Design

> **Superseded in part by ADR 021** (see "Decisions made"): there is no shared transaction,
> `issue()` takes no `tx`, seat ids come from `checkout`, and `ActivationCode` has no foreign keys.

### Prisma models (one migration, `add_order_and_activation_code`)

Assumes D3-B.

```prisma
model Order {
  id               String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  parentName       String
  parentEmail      String
  totalPence       Int
  paymentReference String
  createdAt        DateTime    @default(now()) @db.Timestamptz(3)
  seats            OrderSeat[]
}

model OrderSeat {
  id             String          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orderId        String          @db.Uuid
  order          Order           @relation(fields: [orderId], references: [id])
  courseId       String          @db.Uuid
  course         Course          @relation(fields: [courseId], references: [id])
  year           Int
  pricePence     Int
  activationCode ActivationCode?

  @@index([orderId])
}

model ActivationCode {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  codeHash  String    @unique
  seatId    String    @unique @db.Uuid
  seat      OrderSeat @relation(fields: [seatId], references: [id])
  courseId  String    @db.Uuid
  year      Int
  createdAt DateTime  @default(now()) @db.Timestamptz(3)
}
```

`redeemedAt` and the enrolment link are added in slice 3, when they are first used.

### Contract (`packages/contracts/src/index.ts`)

```ts
export interface CheckoutSeatRequest { courseId: string; year: number }
export interface CheckoutRequest {
  parentName: string;
  parentEmail: string;
  seats: CheckoutSeatRequest[];
}
export interface CheckoutSeatResponse {
  courseId: string;
  subject: string;
  year: number;
  pricePence: number;
  activationCode: string;
}
export interface CheckoutResponse {
  orderId: string;
  totalPence: number;
  seats: CheckoutSeatResponse[];
}
```

### Endpoint

`POST /api/orders`, body `CheckoutRequest`.

| Status | When |
|---|---|
| 201 | Order paid; body `CheckoutResponse`, seats in request order |
| 400 | Body fails shape validation, or carries unknown properties |
| 422 | A `courseId` does not exist, or a seat's year is outside its course's range |

Flow in `CheckoutService.checkout()`: load courses through `CatalogueService` → check every
seat → compute total → `gateway.charge()` → `prisma.$transaction`: create order and seats,
call `ActivationService.issue(tx, seats)` → return plain codes mapped to seats.

Public surface of `activation` in this slice:
`ActivationService.issue(tx, seats: { seatId, courseId, year }[]): Promise<{ seatId, code }[]>`.

### Web

`/checkout` reads `courseId` and `year`, shows a summary `Card`, a form (`Field` name,
`Field` email, `Button` "Pay £199") and posts one seat. On 201 it goes to the confirmation
(per D4), which shows the code, the full link and the "save it now" notice. On an error
response it shows `Notice variant="error"` and keeps the form filled.

## 4. File scope

```
packages/contracts/src/index.ts                        add the four Checkout* types

api/package.json                                       validation dependencies (D1)
api/prisma/schema.prisma                               Order, OrderSeat, ActivationCode
api/prisma/migrations/<ts>_add_order_and_activation_code/migration.sql
api/src/app.setup.ts                                   global ValidationPipe
api/src/app.module.ts                                  import CheckoutModule
api/src/testing/reset-database.ts                      new: resetDatabase(prisma)

api/src/catalogue/course-year.ts (+ spec)              new: courseCoversYear()
api/src/catalogue/catalogue.service.ts                 add findCoursesByIds()

api/src/activation/activation.module.ts                new; exports ActivationService
api/src/activation/activation.service.ts               new: issue(tx, seats)
api/src/activation/activation-code.ts (+ spec)         new: generate, normalise, hash

api/src/checkout/checkout.module.ts                    new
api/src/checkout/checkout.controller.ts                new: POST /api/orders
api/src/checkout/checkout.service.ts                   new
api/src/checkout/dto/checkout-request.dto.ts           new
api/src/checkout/payment/payment-gateway.ts            new: interface + token
api/src/checkout/payment/mock-payment-gateway.ts       new
api/src/checkout/checkout.int.spec.ts                  new

web/package.json                                       react-hook-form
web/src/App.tsx                                        /checkout, /checkout/confirmation, /activate placeholder
web/src/api/orders.ts                                  new: createOrder()
web/src/activation-link.ts                             new
web/src/pages/CheckoutPage.tsx (+ test)                new
web/src/pages/ConfirmationPage.tsx (+ test)            new (D4-B)
web/src/ui/Field.tsx, web/src/ui/Card.tsx              new
web/src/format-price.ts                                moved out of ProductPage.tsx
web/DESIGN_SYSTEM.md                                   build-status line
```

## 5. Tests for `tdd-guide` (RED before code)

### API unit — `api/src/activation/activation-code.spec.ts`
1. `generateActivationCode()` matches the agreed pattern.
2. 1,000 generated codes are all different and never contain `I`, `O`, `0`, `1`.
3. `normaliseActivationCode()` upper-cases and strips hyphens and surrounding whitespace.
4. `hashActivationCode()` returns 64 lower-case hex characters and is not the code.
5. The hash is the same for the hyphenated, lower-case and normalised forms of one code.
6. The hash equals `createHash('sha256')` of the normalised code.

### API unit — `api/src/catalogue/course-year.spec.ts`
7. Both ends of the range are accepted.
8. One below and one above are rejected.
9. A non-integer year is rejected.

### API integration — `api/src/checkout/checkout.int.spec.ts`
`beforeEach`: `resetDatabase(prisma)` then `seedCourses(prisma)`.

10. One valid seat (Maths, Year 7) → 201 with the full response shape.
11. The order is stored with the parent's details, a `paymentReference` and one seat.
12. Exactly one `ActivationCode` row; `codeHash` is SHA-256 of the normalised returned code.
13. The plaintext code appears in no column of `Order`, `OrderSeat` or `ActivationCode`.
14. Two seats → 201, two different codes in request order, `totalPence` 39800.
15. Science, Year 12 → 422; nothing stored.
16. Science, Year 11 → 201.
17. One valid and one out-of-range seat → 422 and nothing stored.
18. A well-formed but unknown `courseId` → 422 and nothing stored.
19. Table-driven 400s, each storing nothing: missing/blank `parentName`; invalid
    `parentEmail`; missing/empty `seats`; 11 seats; non-UUID `courseId`; `year` as `"7"`;
    `year` 7.5; a seat that is not an object.
20. An extra property (`pricePence` on a seat, `totalPence` on the body) → 400.
21. Two identical requests create two orders with different codes.

### Web — `web/src/pages/CheckoutPage.test.tsx`
22. Shows the summary: Maths, Year 7, £199.
23. A missing or unknown `courseId`, a missing `year` and a year outside the range each
    show a notice with a link back and no form.
24. Submitting empty shows a required error under each field and sends no `POST`.
25. An invalid email shows an error and sends no `POST`.
26. A valid submit sends `POST /api/orders` with the expected JSON, `year` as a number.
27. After 201 the activation code and a link ending in `/activate#code=<code>` are shown.
28. After a 422 or 500 an alert is shown, the form keeps its values and the button is enabled.
29. The pay button is disabled while the request is pending.

### Web — `web/src/pages/ConfirmationPage.test.tsx` (D4-B only)
30. Opened without router state: a notice and a link to the courses; no code.

## 6. Ordered tasks

| # | Step | Agent / pipeline |
|---|---|---|
| 1 | User decides D1–D5; ADRs, `PROJECT.md`, `STATE.md` | — |
| 2 | Harness: `reset-database.ts`; dependencies; contract types | simplified |
| 3 | RED: tests 1–21 (API) | `tdd-guide` |
| 4 | Schema + migration, helpers, modules, DTOs, gateway → GREEN | parent |
| 5 | RED: tests 22–30 (web) | `tdd-guide` |
| 6 | `Field`, `Card`, API client, pages, routes → GREEN | parent |
| 7 | One review over API and web | `typescript-reviewer` |
| 8 | Full slice diff | `code-reviewer` |
| 9 | **[CRITICAL]** access-path generation | `security-reviewer`, must end in PASS |
| 10 | Verification, commits, close the slice | parent |

Focus for `security-reviewer`: randomness source and bias; hash-only storage; no plaintext
in logs, URLs or the database; validation and mass assignment on `POST /api/orders`; price
computed server-side; atomicity of order and codes; where the SPA keeps the code.

## 7. Risks

- **Nested validation fails open (D1-A).** Without `@ValidateNested({ each: true })` and
  `@Type(() => SeatDto)` the seats are not validated. Tests 19 and 20 catch it.
- **`ValidationPipe` and `import type`.** The DTO must be imported as a value in the
  controller, or the pipe validates nothing. Test 19 catches it.
- **Truncate order between spec files.** Safe only with `--runInBand`.
- **Lock file.** New dependencies installed on macOS must not drop the Linux bindings.
- **Prisma interactive transaction with the pg adapter.** Confirm early in step 4.
- **Router state on reload (D4-B).** Checked by hand.
- **Double click.** No idempotency; the disabled-while-pending button is the only guard.

## 8. Time

Roadmap: 35 minutes. Planner's estimate with the full pipeline: 70–85 minutes. Lean cut,
in order: drop the copy button; D4-A instead of D4-B; drop tests 6, 16, 21 and 29; plain
`div` instead of `Card`. Not cuttable: the reset helper, tests 12, 13, 15, 17 and 19, and
`security-reviewer`.

## 9. Verification

```
docker compose down -v
docker compose up --build -d --wait
docker compose logs migrate
ID=$(curl -s localhost:8080/api/courses | node -pe "JSON.parse(require('fs').readFileSync(0)).find(c=>c.subject==='Science').id")
curl -s -i -X POST localhost:8080/api/orders -H 'content-type: application/json' \
  -d "{\"parentName\":\"Pat\",\"parentEmail\":\"pat@example.com\",\"seats\":[{\"courseId\":\"$ID\",\"year\":7}]}"
curl -s -i -X POST localhost:8080/api/orders -H 'content-type: application/json' \
  -d "{\"parentName\":\"Pat\",\"parentEmail\":\"pat@example.com\",\"seats\":[{\"courseId\":\"$ID\",\"year\":12}]}"
docker compose exec db psql -U mes -d mes -c 'select "codeHash" from "ActivationCode"'
docker compose logs api | grep -c -E '[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}'
npm test -w api && npm run test:int -w api && npm test -w web
```

Expected: three migrations applied; 201 with a code; 422; one 64-character hex hash; no
codes in the API log (D5-B); all tests pass.

By hand at `http://localhost:8080/`: pick Maths / Year 7 → Continue → summary → empty
submit shows errors → pay → code and link shown → the link opens the `/activate`
placeholder → `/checkout?courseId=x&year=99` shows the notice.

## 10. Commits

```
docs(planning): plan slice 2 and record checkout decisions
feat(checkout): create a paid order and issue activation codes
feat(web): checkout form and order confirmation
docs(planning): close slice 2
```
