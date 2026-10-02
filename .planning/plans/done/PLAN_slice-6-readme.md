# PLAN — Slice 6: README and delivery

Plan for the last slice: a root `README.md`, a clean-clone check and the hand-in. Produced
by `planner`. **Done**; the user's decisions and what changed are recorded below.

## Decisions made

| # | Decision |
|---|---|
| D1 | One README, ADRs and plans linked |
| D2 | Curated table of key decisions plus a link to the register |
| D3 | Factual AI section: model named, plans linked, "the agent wrote, the user decided" |
| D4 | Minimal tidy of `AGENT_ASSIGNMENT.md`, `slice-kickoff.md`, `ROADMAP.md` status |
| D5 | Three Mermaid diagrams: deployment, modules, journey sequence |
| D6 | **No time statement** (the user's call, against the recommendation) |
| D7 | Both open items left as limitations |
| D8 | **The repository is made public** by the user (against the recommendation) |
| D9, D10 | No CI, no extra scripts, no host-development section |

## Changed during implementation

- `code-reviewer` found four inaccurate statements (when "already used" appears, what is
  refused on a duplicate, the open case of checkout, what the plans record) and several
  omissions; all fixed before the commit.
- The README is 265 lines, above the 250-line target: the tables have long rows. The
  repository map was cut.
- Clean-clone check: cloned from GitHub into a differently named directory, no `.env`;
  `docker compose up --build -d --wait`; journey walked in a browser (purchase, link,
  account, LMS, lesson, sign out, closed `/lms`, sign in, reused code refused); `npm ci`,
  `npm test` (79 + 102) and `npm run test:int` (207) pass.
- The first start in the clone used plain `docker compose up` and showed a stale page: a
  `web` image left by a clean-clone check of an earlier slice had the same name. A machine
  that never built the project has no such image; the README says `--build` regardless.
- The browser kept the old `index.html` after the rebuild: nginx sends no `Cache-Control`
  for it. Not fixed (nginx config is out of this slice's scope); recorded in `STATE.md`.
- The brief is absent from every pushed commit; checked before the repository goes public.

**Findings that change the slice**

- There is no root `README.md`. The whole deliverable is new.
- DEL-1 is not met: the GitHub repository is private with no collaborators. Sharing it is
  the user's action.
- The stack is running on port 8080. A clone into a directory with the same name would
  reuse the Compose project name and the `db-data` volume, so the check would not be clean.
- Root test scripts already exist: `npm test` (API unit + web) and `npm run test:int`.
- Not checked while planning: no suite was run and no command was tried from a clean clone.

## 1. Goal

A reviewer who clones the repository can start the app with one command, walk the journey
using only the README, and understand the architecture, the decisions and how AI was used.

## 2. Requirements covered

DEL-1, DEL-3, DEL-4, DEL-5, TEC-3.

## 3. What the brief asks, mapped to the README

| Brief | README section |
|---|---|
| Short README: architecture overview | Architecture |
| Key technical decisions | Key decisions |
| How AI tools were used, with artefacts attached | How AI was used |
| Runnable with a single `docker compose up`; all services through Compose | Run it |
| Working application for the core journey end to end | Walk the journey |
| Public repository, or private and shared with the four named reviewers | User action (D8) |
| Evaluated on architecture, clarity, product flow, engineering judgment | Architecture, Key decisions, Limitations |
| Remaining responsible for architecture, quality and decisions while using AI | How AI was used: "who decided what" |
| 3–4 hours; clarity and pragmatism over completeness | Time and scope note (D6) |
| Not a production system | Limitations, each with a one-line production answer |

The brief says "short README". That drives D1.

## 4. Decisions needed (the user owns these)

**D1. README length and structure**
- A. One README of about 200–250 lines; ADRs and plans linked, not copied.
- B. README plus a separate architecture document.
- C. One long README with everything.
- Recommendation: A.

**D2. How to present the 27 ADRs**
- A. A curated table of about 8 with one line of "why" each, plus a link to the register.
- B. All 27 rows.
- Recommendation: A, with 012, 021, 022, 005/027, 009/020, 008/026, 025 and 006/013.

**D3. AI usage: how candid, what form**
- A. Factual and specific: the tool, the pipeline, a "who decided what" table, 3–4 concrete
  examples, links to artefacts, one line on what the process cost.
- B. A general paragraph plus links.
- Recommendation: A. Sub-decisions: name the model (yes, the commit trailers already do);
  link `.planning/plans/done/` (yes); state that the agent wrote the code and the user made
  every decision and approved each step (the user must confirm this is accurate).

**D4. Tidying `.planning/` and `.claude/agents`**
- A. Leave as is.
- B. Minimal tidy, no history rewriting: the empty "Per-slice assignment" stub in
  `AGENT_ASSIGNMENT.md`; the non-English shortcut and emojis in
  `workflows/slice-kickoff.md`; the `ROADMAP.md` status line.
- C. Rewrite plans for readability. Not recommended: plans are evidence.
- Recommendation: B.

**D5. Diagrams**
- A. Two Mermaid diagrams: module dependencies and the happy-path sequence.
- B. Module graph only; sequences as numbered lists.
- C. None.
- Recommendation: A, falling back to B if GitHub does not render it.

**D6. Time statement**
- A. State the real figure in one sentence and say what went past the box and why.
- B. No statement.
- C. Claim "about 4 hours" without knowing. Not recommended.
- Recommendation: A. Blocked on the user supplying the number.

**D7. The two small open items**
- 502 vs 500 for a failed charge (unreachable with the mock gateway): A. leave 500 and list
  it as a limitation; B. implement (full pipeline). Recommendation: A.
- `ActivationService.confirm(codeId)` not bound to the student (Low, safe through the claim
  invariant): A. list as a limitation; B. fix (full pipeline plus security review).
  Recommendation: A.

**D8. How to submit (DEL-1)**
- A. Keep private and invite the four reviewers named in the brief.
- B. Make it public.
- Recommendation: A. The user does it after the final push.

**D9. Root test script and CI**
- Nothing to add to the scripts. CI is out of scope; listed under limitations.

**D10. Host development mode in the README**
- A. Leave it out, one sentence pointing to `.env.example`.
- B. A paragraph with every step verified.
- Recommendation: A.

## 5. README outline

Target about 220 lines, point first.

0. **Title and summary** — what it is; the stack in one line.
1. **Run it** — Docker with Compose v2, no `.env` needed; `docker compose up --build`;
   `http://localhost:8080`; the four services (`db`, `migrate`, `api`, `web`);
   `WEB_PORT` for a port clash; optional env from `.env.example`; reset with
   `docker compose down -v`.
2. **Walk the journey** — choose a course and year → checkout → confirmation page shows the
   activation code and link once (no email) → activate, create the account → `/lms` →
   open a lesson → sign out, sign in. Things to try: reuse the link; a lesson of a course
   not owned; add a second course by code. Exact labels are checked against the running UI.
3. **Tests** — Node ≥ 22.12, `npm ci`; `npm test`; `npm run test:int` (needs Docker);
   what they cover; measured counts; no browser end-to-end suite.
4. **Architecture** — section 7.
5. **Key decisions** — curated table (D2) and a link to the register.
6. **How AI was used** — section 6.
7. **Limitations and what production would do** — section 8.
8. **Repository map**.

## 6. "How AI was used" content

- Tool: Claude Code with five project subagents in `.claude/agents/`; rules in `CLAUDE.md`.
- Pipeline per slice: planner → failing tests first → implementation → TypeScript review →
  code review → security review on the access path, credentials and LMS access control.
- Who decided what: the user — every architecture and product decision, scope, approval;
  the agent — options with trade-offs, plans, tests, code, reviews.
- Examples, each verifiable in the repository:
  1. The user overruled the planner's shared transaction for order and codes (ADR 021;
     plan 2 keeps the rejected design).
  2. `security-reviewer` found that urlencoded bodies allowed login CSRF; the API now
     answers 415 to non-JSON bodies (ADR 026).
  3. Reviewers caught the previous student's courses surviving in the query cache; keys are
     now scoped to the student (plan 4).
  4. Reviews found two race interleavings in the add-course claim step (plan 5).
  5. A scope cut by the user: slice 5 in its smallest variant (ADR 027).
- Artefacts: plans in `.planning/plans/done/`, 27 ADRs, roadmap, requirements, agent
  matrix, kickoff workflow, agent definitions, the commit history.
- What it cost: one honest line, tied to D6.

## 7. Architecture content

- Shape: browser → nginx (`web`, port 8080) serves the SPA and proxies `/api/` to the
  NestJS `api` → PostgreSQL. One origin: no CORS, same-site cookie. `packages/contracts`
  holds shared types.
- Modules: `checkout` → `catalogue`, `activation`; `activation` → `identity`, `lms`;
  `lms` → `identity`, `catalogue`. Modules call exported services and do not read each
  other's tables (ADR 012).
- Endpoints table (nine, with guard and module).
- Data model with owners: `Course`, `Lesson` (catalogue); `Order`, `OrderSeat` (checkout);
  `ActivationCode` (activation); `Student` (identity); `Enrolment` (lms).
- Cross-module writes without a shared transaction: checkout (ADR 021), onboarding
  (ADR 022), add a course (ADR 027), each with its trade-off.
- Security posture: activation code handling (ADR 009, 020), scrypt, session cookie
  (ADR 008, 024), login answer (ADR 026), JSON-only and whitelist validation (ADR 018),
  enrolment-scoped reads (ADR 025).
- What is mocked: payment, email, auth provider, lesson content, visual language.

## 8. Known limitations, grouped, with the production answer

Assembled from `ROADMAP.md` "Out of scope" and `STATE.md`: purchase (guest checkout, no
email, one seat in the UI, always-approving gateway and plain 500, no idempotency key,
orphan codes, year cannot be corrected); onboarding and codes (account without a course,
code pasted rather than carried through sign-in, no undo, duplicate purchase, `confirm`
not bound to the student); sessions and security (no rate limiting, no revocation, no CSRF
token, no password reset, no return path); LMS (plain-text lessons, no progress);
engineering (no browser end-to-end tests, no CI, one deployable, approximate visuals).

## 9. Clean-clone check

1. Push. Stop the running stack in the working copy.
2. Clone from GitHub into a scratch directory with a different name.
3. Confirm the clone has no `.env`, no `task.txt`, no `node_modules`.
4. `docker compose up --build -d --wait`; `migrate` exits 0; `api` and `web` healthy.
5. Walk README section 2 literally; fix the README where the UI differs.
6. `npm ci`, `npm test`, `npm run test:int`; record counts. Check that `pretest`
   (`prisma generate`) works with no `.env`.
7. `docker compose down -v` in the clone.
8. Run plain `docker compose up` once, the exact command of the brief.

Pre-delivery checklist: `task.txt` not tracked; no secrets; no MES assets or image/font
files tracked; font attribution (Inter, SIL OFL, from npm); README renders on GitHub;
tree clean and pushed; repository shared (D8).

## 10. Files in scope

- New: `README.md`
- Edit: `.planning/REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`; under D4-B
  `AGENT_ASSIGNMENT.md`, `workflows/slice-kickoff.md`; possibly `web/DESIGN_SYSTEM.md`.

## 11. Out of scope

Any change under `api/src`, `web/src`, `docker-compose.yml` or `package.json` (a defect
found by the clean-clone check is reported first); CI; a `LICENSE` file; screenshots.

## 12. Pipeline

Simplified: write → `code-reviewer` → commit. Reviewer focus: every command and URL exists,
every claim matches an ADR, no secrets, links resolve, length.

## 13. Acceptance criteria

- [ ] `README.md` covers run, journey, architecture, key decisions, AI usage with artefacts.
- [ ] Every command in the README was executed in the clean clone and worked.
- [ ] The journey was walked in a clean clone following only the README.
- [ ] `npm test` and `npm run test:int` pass in the clean clone.
- [ ] `docker compose up` works with no `.env`.
- [ ] The pre-delivery checklist passes.
- [ ] The repository is shared per D8 (user action).
- [ ] `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md` are final.

## 14. Commits

```
docs(planning): plan slice 6
docs(readme): architecture, decisions, AI usage and how to run
docs(planning): close slice 6
```

## 15. Risks

- The README promises something the UI does not do — every label is checked.
- The clean clone is not clean — different directory name, running stack stopped first.
- `npm test` may fail without `.env` if `prisma generate` wants `DATABASE_URL` — unverified.
- Mermaid or relative links may not render on GitHub — check the pushed page.
- Length creep against "short README" — 250-line cap.
- The time statement — an inaccurate figure is worse than a candid one.
- DEL-1 depends on a user action outside the pipeline.
