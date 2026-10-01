# ROADMAP

Delivery slices for the take-home. Each slice is vertical: when it is done, the app runs
with `docker compose up` and the journey works up to that point.

> **Status: agreed 2026-10-01.** Estimates add up to about 3 h 15 min without slice 5 and
> 3 h 40 min with it.

## Slices

| # | Slice | Requirements | Done when | Estimate | Status |
|---|-------|--------------|-----------|----------|--------|
| 0 | Skeleton: workspaces, `api`, `web`, `contracts`, four compose services, Prisma with the first migration | DEL-2, TEC-1, TEC-2 | The SPA page loads and gets a response from the API that reached the database | 40 min | done |
| 1 | Catalogue and product page: seed of three courses; select a course, then the year from its range | PUR-1, PUR-2, CAT-1, CAT-2 | The parent selects a course and can pick only a year that course covers | 25 min | not started |
| 2 | Checkout and activation code: order with seats, mock gateway, code issue, confirmation page | PUR-3, PUR-4 | After paying, the link and the code are shown; a year outside the course's range is rejected | 35 min | not started |
| 3 | Onboarding: form, username, password; account and enrolment in one transaction | ONB-1 – ONB-4 | A student follows the link, creates an account and lands in the LMS; the code does not work twice | 40 min | not started |
| 4 | LMS: login and logout, guard, dashboard, lesson list, lesson page; seed of lessons | LMS-1 – LMS-4 | The LMS is unreachable without login; a lesson of a course the student is not enrolled in does not open | 35 min | not started |
| 5 | Optional — add a course to an existing account: code carried through login, code entry in the LMS, duplicate message | ADR 005 | A second code adds a course for a logged-in student; a duplicate is rejected and the code stays valid | 25 min | not started |
| 6 | README and delivery: architecture, decisions, AI usage with artefacts, clean-clone check | DEL-1, DEL-3 – DEL-5, TEC-3 | The full journey is walked through by hand following the README | 20 min | not started |

Notes:
- Slice 5 is the first to be cut if time runs out (ADR 005); slice 6 is mandatory.
- Slices 0 and 6 use the simplified pipeline. Slices 2, 3, 4 and 5 require
  `security-reviewer`.
- Slice 0 carries the most setup risk: Prisma with NestJS in Docker, the types package in
  workspaces, images built from the repository root.

## Out of scope

Things deliberately not built. Each entry says what a production system would do instead;
this list feeds the README.

- **Parent accounts** — checkout is guest-only (ADR 001). Production: parent login, order
  history, re-sending invitations.
- **Email delivery** — the invitation link is shown on the confirmation page and logged.
  Production: sent by email.
- **Several students per order in the UI** — the API accepts many seats, the UI sends one
  (ADR 003). Production: "add student" in checkout, sibling pricing.
- **Several courses per student in one order** — one course per seat (ADR 003).
  Production: multi-subject selection with bundle pricing.
- **Browser end-to-end tests** — the journey is checked by hand (ADR 013). Production: a
  small suite for purchase → onboarding → LMS.
- **Declined payments** — the mock gateway always approves (ADR 010). Production: a
  provider's hosted page, pending orders confirmed by webhook.
- **Password reset** — the student has a username and no email (ADR 007). Production:
  recovery through the parent's account.
- **Resolving a duplicate purchase** — the student is told to contact their parent
  (ADR 005). Production: prevented at checkout or refunded.
- **Correcting the year after purchase** — not possible here. Production: changed by the
  parent or by support.
- **Per-year products** — one course per subject (ADR 002). Production: a product per
  subject and year, with its own price and content.
