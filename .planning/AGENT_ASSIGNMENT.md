# Agent assignment matrix

Which agent runs for which kind of task. Read before writing code; the pipeline for a
slice is fixed in its plan and follows this matrix.

## How to use

1. Find the task type in the table
2. Follow the pipeline in that row, in order
3. **[CRITICAL]** = skipping the agent blocks the slice
4. Start a slice with the template in [`workflows/slice-kickoff.md`](workflows/slice-kickoff.md)

**Full pipeline:**
```
planner → tdd-guide → code → typescript-reviewer → code-reviewer → security-reviewer (if critical)
```

**Simplified pipeline:**
```
code → code-reviewer
```

## Agents

| Agent | Role | Writes files? |
|-------|------|---------------|
| `planner` | Plan, acceptance criteria, file scope, open decisions | no |
| `tdd-guide` | Failing tests before code (RED) | tests only |
| `typescript-reviewer` | NestJS / React review | no |
| `code-reviewer` | Diff-level quality and scope review | no |
| `security-reviewer` | Access path, credentials, access control | no |

Implementation (GREEN, refactor) is done by the parent session, not by a subagent.

## Task type → pipeline

| Task type | Pipeline |
|-----------|----------|
| Repo scaffolding, Docker/compose, tooling config | simplified |
| Seed data, docs, README | simplified |
| Presentational UI (pages, layout, styling) | simplified, plus `typescript-reviewer` |
| Catalogue and course selection | full |
| Mock checkout and order creation | full |
| Student access path generation and redemption | full + `security-reviewer` **[CRITICAL]** |
| Onboarding form and account activation | full + `security-reviewer` **[CRITICAL]** |
| LMS authentication and access control | full + `security-reviewer` **[CRITICAL]** |
| Dashboard, lesson list, lesson access (API) | full |
| UI with logic (forms, route guards, API client) | full |

## Critical points

- **[CRITICAL] `security-reviewer`** — student access path: it is the only link between a
  purchase and a student account
- **[CRITICAL] `security-reviewer`** — account activation and credential handling
- **[CRITICAL] `security-reviewer`** — LMS access control enforced server-side

## Per-slice assignment

The pipeline planned for each slice is in its plan under [`plans/done/`](plans/done/);
deviations are under "Changed during implementation" where there were any.
