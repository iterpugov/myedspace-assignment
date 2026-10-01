# CLAUDE.md — MyEdSpace take-home

A small web app that mocks the MES core journey: parent purchases → student onboards →
student accesses the LMS. Time-boxed to 3–4 hours; clarity and pragmatism over completeness.
The brief is in `task.txt`.

## Read before starting work

- `.planning/PROJECT.md` — stack, key decisions, constraints
- `.planning/REQUIREMENTS.md` — requirements from the brief, with IDs
- `.planning/ROADMAP.md` — delivery slices and their done criteria
- `.planning/STATE.md` — current position, open decisions, blockers
- `.planning/AGENT_ASSIGNMENT.md` — **which agents run for which kind of task** (mandatory)
- `.planning/README.md` — map of `.planning/` and the "where does a new doc go" rule

## Decisions are made with the user

The user owns architecture and technical decisions and must be able to defend each one.

- **Never decide architecture alone.** Bring a decision as options, trade-offs and a
  recommendation; wait for the user's call.
- A decision exists only once it is recorded: an ADR in `.planning/adr/` plus a line in
  `PROJECT.md`. Until then it is listed under "Open decisions" in `STATE.md`.
- Agents that hit an undecided question **flag it and stop** — they do not pick a default.

## Mandatory pipeline for any development task

```
1. planner            — plan the task (if non-trivial)
2. tdd-guide          — write failing tests BEFORE code (RED)
3. [implementation]   — minimal code to pass (GREEN), then refactor
4. typescript-reviewer — after any TS/JS implementation
5. code-reviewer      — after every significant chunk of code
6. security-reviewer  — on critical points (see AGENT_ASSIGNMENT.md)
```

**Mode: semi-auto.** Run one pipeline step, report, then stop for the user's confirmation,
unless the user said "run full pipeline". Kickoff template and shortcut commands:
`.planning/workflows/slice-kickoff.md`.

### Simplified pipeline

```
[code] → code-reviewer
```

Applies to scaffolding, Docker/compose, tooling config, seed data, docs and purely
presentational UI. TDD and security review do not apply there.

## Hard rules

- **`tdd-guide` always before code** for behaviour (domain logic, API endpoints, guards).
  The only exceptions are the simplified-pipeline cases above.
- **`security-reviewer` is mandatory** on the student access path (invitation), account
  activation / credentials, and LMS access control.
- **Scope is the brief.** Anything beyond `REQUIREMENTS.md` goes to "Out of scope" in
  `ROADMAP.md`, not into code.
- **`docker compose up` must work** from a clean clone at the end of every slice.
- **No secrets in the repo.** Local defaults live in a committed `.env.example`.
- **Keep AI artefacts.** Plans stay in `.planning/plans/` (moved to `plans/done/` when
  finished) — they are a deliverable for the README's "AI usage" section.

## Commits and documents — style

**Commits** (English only):
- **Subject** — `type(scope): summary`, up to 72 characters, no trailing period.
  Types: `feat fix refactor docs test chore perf ci build revert`.
- **Body** — a blank line after the subject, then up to 8 lines of short bullets.
- **Reasoning and investigation history** go to an ADR or a plan, not into the commit.
- One commit per pipeline-complete unit of work; a slice is a short commit series.

Example:
```
feat(onboarding): redeem invitation and activate student account

- Invitation is single-use; a second redeem returns 409
- Regression test for expired invitations
```

**Documents** (`.planning/`, README) — English:
- **Point first**: 1–2 sentences on what this is and why, then details.
- **Order**: context → the main thing → steps → examples (only if needed).
- **Paragraphs** up to 3–4 sentences; sequences as numbered lists, parameters as a list or table.
- **No internals or history** in the main text — put them in a "Notes" section or drop them.

## Stack

Decided so far (details and rationale in `.planning/PROJECT.md`):

| Part | Technology | Reviewer |
|------|------------|----------|
| Backend API | TypeScript / NestJS | `typescript-reviewer` |
| Frontend | TypeScript / React SPA, separate from the API | `typescript-reviewer` |
| Persistence | PostgreSQL / Prisma; migrations in a one-shot `migrate` compose service | `typescript-reviewer` |
| Shared contracts | `packages/contracts/`, types only (npm workspaces) | `typescript-reviewer` |
| Tests | API: Jest + Testcontainers; SPA: Vitest + React Testing Library | — |

Remaining open decisions are listed in `.planning/STATE.md`.
