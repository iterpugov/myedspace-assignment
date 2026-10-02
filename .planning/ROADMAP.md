# ROADMAP

Delivery slices for the take-home. Each slice is vertical: when it is done, the app runs
with `docker compose up` and the journey works up to that point.

> **Status: agreed 2026-10-01; all slices done.** The estimates below are the ones
> made when the roadmap was agreed and were not revised afterwards.

## Slices

| # | Slice | Requirements | Done when | Estimate | Status |
|---|-------|--------------|-----------|----------|--------|
| 0 | Skeleton: workspaces, `api`, `web`, `contracts`, four compose services, Prisma with the first migration | DEL-2, TEC-1, TEC-2 | The SPA page loads and gets a response from the API that reached the database | 40 min | done |
| 1 | Design foundation, catalogue and product page: tokens and components from `web/DESIGN_SYSTEM.md`; seed of three courses; select a course, then the year from its range | PUR-1, PUR-2, CAT-1, CAT-2 | The parent selects a course and can pick only a year that course covers; the page is built from the documented components | 55 min | done |
| 2 | Checkout and activation code: order with seats, mock gateway, code issue, confirmation page | PUR-3, PUR-4 | After paying, the link and the code are shown; a year outside the course's range is rejected | 35 min | done |
| 3 | Onboarding: form, username, password; account and enrolment created when the code is redeemed (ADR 022) | ONB-1 – ONB-4 | A student follows the link, creates an account and lands in the LMS; the code does not work twice | 40 min | done |
| 4 | LMS: login and logout, guard, dashboard, lesson list, lesson page; seed of lessons | LMS-1 – LMS-4 | The LMS is unreachable without login; a lesson of a course the student is not enrolled in does not open | 35 min | done |
| 5 | Optional — add a course to an existing account: code entry in the LMS, duplicate message (smallest variant, ADR 027) | ADR 005, ADR 027 | A second code adds a course for a logged-in student; a duplicate is rejected and the code stays valid | 25 min | done |
| 6 | README and delivery: architecture, decisions, AI usage with artefacts, clean-clone check | DEL-1, DEL-3 – DEL-5, TEC-3 | The full journey is walked through by hand following the README | 20 min | done |

Notes:
- Slice 5 is the first to be cut if time runs out (ADR 005); slice 6 is mandatory.
- Slices 0 and 6 use the simplified pipeline. Slices 2, 3, 4 and 5 require
  `security-reviewer`.
- Slice 0 carries the most setup risk: Prisma with NestJS in Docker, the types package in
  workspaces, images built from the repository root.

## Out of scope

Things deliberately not built. Each entry says what a production system would do instead;
this list feeds the README.

- **Continuous integration** — tests are run by hand. Production: the same test commands
  on every push.
- **Parent accounts** — checkout is guest-only (ADR 001). Production: parent login, order
  history, re-sending invitations.
- **Email delivery** — the invitation link is shown on the confirmation page.
  Production: sent by email.
- **Several students per order in the UI** — the API accepts many seats, the UI sends one
  (ADR 003). Production: "add student" in checkout, sibling pricing.
- **Several courses per student in one order** — one course per seat (ADR 003).
  Production: multi-subject selection with bundle pricing.
- **Marketing sections and brand assets** — review carousels, curriculum sliders,
  photography and the MES logo are not reproduced (ADR 016). Production: the product's own
  design system and assets.
- **Browser end-to-end tests** — the journey is checked by hand (ADR 013). Production: a
  small suite for purchase → onboarding → LMS.
- **Declined payments** — the mock gateway always approves (ADR 010). Production: a
  provider's hosted page, pending orders confirmed by webhook.
- **Idempotent checkout** — a double submit creates two orders; the form only disables the
  button while a request is pending. Production: an idempotency key per checkout attempt.
- **Rate limiting** — the anonymous checkout and sign-in endpoints are not throttled, and
  each sign-in attempt costs one scrypt run. Production: limits per client at the gateway,
  on code redemption and sign-in above all, and lockout per account.
- **Cleaning up orphan activation codes** — a code issued for an order that then failed
  stays in the table (ADR 021). Production: removed by age.
- **Accounts without a course** — an interrupted or lost redemption can leave one (ADR 022);
  the student can add a code in the LMS (ADR 027). Production: cleaned up by age.
- **Carrying the code through sign-in** — a student who already has an account pastes the
  code into "Add a course" (ADR 027). Production: the link opens the right flow for whoever
  is signed in, and shows what the code grants before it is used.
- **Undoing a course added to the wrong account** — at a shared browser the course goes to
  whoever is signed in; the page names the account. Production: moved by support or from
  the parent's account.
- **CSRF tokens** — the session cookie is `SameSite=Strict` and the API refuses any body
  that is not JSON (ADR 026). Production: the same, plus a token if any cross-site flow
  appears.
- **Revoking a session** — signing out clears the cookie; a copied token stays valid until
  it expires, at most four hours (ADR 008, ADR 026). Production: short-lived access tokens
  with a revocable refresh token.
- **Lesson progress and rich lessons** — a lesson is plain text with no completion mark,
  video or markdown (ADR 025). Production: a content service with media, and per-student
  progress.
- **Returning to the requested page after sign-in** — the student always lands on the
  dashboard. Production: a validated return path.
- **Password reset** — the student has a username and no email (ADR 007). Production:
  recovery through the parent's account.
- **Resolving a duplicate purchase** — the student is told to contact their parent
  (ADR 005). Production: prevented at checkout or refunded.
- **Correcting the year after purchase** — not possible here. Production: changed by the
  parent or by support.
- **Per-year products** — one course per subject (ADR 002). Production: a product per
  subject and year, with its own price and content.
