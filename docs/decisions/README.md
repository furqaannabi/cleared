# Decisions

Architecture and product decisions for Cleared, one file per decision.

## Rules

- File name: `YYYY-MM-DD-short-title.md`, dated the day the decision was made.
- Only William or Furqaan make decisions. The agent records them; it never decides.
- **Never edit a record after it is written.** To change a decision, write a new record that supersedes the old one, and name the old one in the new record's "Supersedes" field and mark it superseded in the table below.
- Link each record from the Revision table of every spec it affects in `docs/specs/`.
- If a decision changes `docs/PRODUCT.md`, update that line and point it at the record.

## Format

```md
# <Decision in a few words>

**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded by <file>
**Decided by:** <name>
**Supersedes:** <file> | none

## Context
What prompted the decision, in a few sentences.

## Options
1. **<Option>.** Trade-offs.
2. **<Option>.** Trade-offs.

## Decision
What was chosen, in one or two sentences.

## Consequences
What changes because of this: docs, code, scope, risks.
```

## Records

| Date | Decision | Status |
| --- | --- | --- |
| 2026-10-06 | [Evidence view uses cards, not AG Grid](2026-10-06-evidence-view-cards.md) | Superseded by [2026-10-06-evidence-view-ag-grid.md](2026-10-06-evidence-view-ag-grid.md) |
| 2026-10-06 | [Evidence table and brand dashboard use AG Grid on tablet and up](2026-10-06-evidence-view-ag-grid.md) | Accepted |
| 2026-10-06 | [Visual world is set by a design prototype in design/](2026-10-06-design-prototype-first.md) | Accepted |
