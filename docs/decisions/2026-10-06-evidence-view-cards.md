# Evidence view uses cards, not AG Grid

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
`docs/PRODUCT.md` named AG Grid for the "evidence table and dashboard". `CLAUDE.md` makes mobile-first non-negotiable: a data table never scrolls sideways on a phone, it becomes cards. The evidence view needs about five columns (item, kind, status, brief line, evidence with timestamp), which cannot fit at 375px in AG Grid without sideways scrolling. Creators will check draft results mostly on their phones.

## Options
1. **AG Grid on tablet and up, cards on phones, for both screens.** Full grid on big screens, but two views to build and test for each screen.
2. **AG Grid everywhere, with columns hidden and text wrapped on mobile.** One component, but cramped on phones, hidden columns are hard to reach, and it breaks the mobile rule in spirit.
3. **Drop AG Grid entirely.** Least work, but loses sorting and filtering where a creator has many deals.
4. **Cards for the evidence view at every size; AG Grid only for the creator dashboard on tablet and up, cards on phones.**

## Decision
Option 4. A deliverable's checklist is 5–15 items: a checklist, not a spreadsheet. Each item needs room for its status, the brief line it came from, a clickable timestamp, and the brand's "object" action, which cards handle better than grid cells at any width. AG Grid stays where a grid earns its place: sorting and filtering many deliverables on the creator dashboard.

## Consequences
- `docs/PRODUCT.md` "Built with" row changed to match.
- `CLAUDE.md` Tech Stack, Mobile-First and evidence view sections changed to match.
- The evidence view is a single responsive component. The creator dashboard has two renderings (AG Grid at `md:` and up, cards below) over the same data.
