# Evidence table and brand dashboard use AG Grid on tablet and up

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William
**Supersedes:** [2026-10-06-evidence-view-cards.md](2026-10-06-evidence-view-cards.md)

## Context
The earlier record moved the evidence view to cards at every size and kept AG Grid for the creator dashboard only. It was written before the signed-off `docs/PRODUCT.md` made two things clear:

- AG Grid is a hackathon sponsor tool. Using it meaningfully is what makes Cleared eligible for AG Grid's prize.
- PRODUCT.md names AG Grid (with AG Studio) for the **evidence table and brand dashboard**, the screens judges see in the demo.

The mobile-first rule in `CLAUDE.md` still holds: a data table never scrolls sideways on a phone.

## Options
1. **AG Grid on `md:` and up, cards on phones, for the evidence table and brand dashboard.** Visible sponsor use where judges look, and the mobile rule holds. Two renderings of the same data to build and test.
2. **Keep cards for the evidence view.** One component, but AG Grid only appears on the brand dashboard. Weaker sponsor case.
3. **AG Grid at every size, with columns cut down on mobile.** Strongest sponsor use, but cramped on phones and it breaks the mobile rule.

## Decision
Option 1. The evidence table and the brand dashboard render in AG Grid from `md:` up. Below `md:`, the same data renders as cards.

## Consequences
- Supersedes the earlier record. `docs/PRODUCT.md` needs no change; it already names AG Grid for these screens.
- `CLAUDE.md` Tech Stack, Mobile-First and evidence view sections changed to match.
- Each of these screens has two renderings over one data source. Both are tested, and both must show the same status, brief line, evidence and timestamp for every item.
- Whether the creator dashboard also uses AG Grid is left to its spec.
