# Slice kickoff (semi-auto)

Prompt template for starting a roadmap slice or implementing an ADR. Fill the
placeholders and send it in the Claude Code session.

---

## Prompt template

```
@CLAUDE.md @.planning/AGENT_ASSIGNMENT.md @.planning/workflows/slice-kickoff.md
@<PATH_TO_SLICE_OR_ADR>

**Task:** implement slice «<SLICE_NAME>» from the doc above.
**Requirements:** <IDs from REQUIREMENTS.md>

**Mode:** semi-auto — run ONE pipeline step, then stop for my confirmation
(unless I said "run full pipeline").

**Step 1 (planner):** delegate to the `planner` subagent (read-only — no code, no file
edits). Parent must not implement in step 1; wait for planner output, save it to
`.planning/plans/PLAN_<slice>.md`, then stop.

**Pipeline for this slice** (from AGENT_ASSIGNMENT.md; adjust if different):
<planner → tdd-guide → code → typescript-reviewer → code-reviewer → security-reviewer? → commit>

**Scope / out of scope:**
- In: …
- Out: …

Start with step 1. After each step, output:
- ✅ done / ⏭ skipped / 🚫 blocked
- what changed (files)
- open decisions raised
- recommended next step
```

---

## Example

```
@CLAUDE.md @.planning/AGENT_ASSIGNMENT.md @.planning/workflows/slice-kickoff.md
@.planning/ROADMAP.md

**Task:** implement slice «Student onboarding»
**Requirements:** ONB-1, ONB-2, ONB-3, ONB-4

**Mode:** semi-auto

**Pipeline:** planner → tdd-guide → code → typescript-reviewer → code-reviewer →
security-reviewer [CRITICAL] → commit

Start with step 1.
```

---

## Steps

1. **planner** — subagent, read-only. Output saved to `.planning/plans/PLAN_<slice>.md`.
   If it raises open decisions, stop and resolve them with the user before step 2.
2. **tdd-guide** — subagent writes failing tests and confirms RED with the runner output.
3. **code** — parent session writes the minimal implementation to reach GREEN, then refactors.
4. **typescript-reviewer** — subagent, read-only. Parent fixes Critical and Warning findings.
5. **code-reviewer** — subagent, read-only, on the full diff of the slice.
6. **security-reviewer** — only where `AGENT_ASSIGNMENT.md` marks it; must end in PASS.
7. **commit** — per `CLAUDE.md` style. Update `REQUIREMENTS.md` markers and `STATE.md`,
   move the plan to `plans/done/`.

---

## Shortcut commands (same chat, next messages)

| You send | Agent does |
|----------|------------|
| `next` / `далее` | Next pipeline step for the current slice |
| `run full pipeline` | All steps until commit or blocker |
| `skip <step>` | Skip an optional step and say so in the report |
| `slice done` | Mark the slice complete; show the next one from the roadmap |
