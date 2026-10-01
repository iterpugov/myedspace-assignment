# `.planning/` — map

Planning and decision documents for the MyEdSpace take-home. **Only files declared
mandatory in [`CLAUDE.md`](../CLAUDE.md) live in the root**; everything else sits in the
folders below.

## Root — canon, read first

| File | What it is |
|---|---|
| [`PROJECT.md`](PROJECT.md) | Product, stack, key decisions, constraints |
| [`REQUIREMENTS.md`](REQUIREMENTS.md) | Requirements from the brief, with IDs and status markers |
| [`ROADMAP.md`](ROADMAP.md) | Delivery slices, done criteria, out of scope |
| [`STATE.md`](STATE.md) | Where we are now: slice, open decisions, blockers. Single source of truth |
| [`AGENT_ASSIGNMENT.md`](AGENT_ASSIGNMENT.md) | Which agents run for which task (mandatory before code) |

## Folders

| Folder | Contents | Rule |
|---|---|---|
| [`adr/`](adr/) | Architecture decisions `NNN-kebab-title.md` + [register](adr/README.md) | New decision — new file + a row in the register. Written only after the user decides |
| [`plans/`](plans/) | Active implementation plans `PLAN_<slice>.md` (planner output) | When the work closes, move to `plans/done/` in the same commit |
| `plans/done/` | Executed plans | Kept as AI-usage artefacts for the README |
| [`workflows/`](workflows/) | Prompt and process templates (slice kickoff) | — |

## Rules against root sprawl

1. A new root file is added only together with a line in `CLAUDE.md` ("Read before
   starting work") and a row in the table above.
2. Once a document's content has moved into code, seeds or migrations, the document is
   deleted rather than kept as a second copy.
3. Plan closed → `plans/done/` in the commit that closes the work.
