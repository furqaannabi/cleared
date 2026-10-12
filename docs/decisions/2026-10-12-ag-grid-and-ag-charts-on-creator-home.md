# The creator's payment history uses AG Grid, and its charts AG Charts

**Date:** 2026-10-12
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
The creator's home (`docs/specs/creator-home-frd.md`) gains a payment history, a "Paid each month" chart and small trend lines. The [AG Grid record](2026-10-06-evidence-view-ag-grid.md) names AG Grid for the evidence table and the brand dashboard and leaves the creator dashboard to its spec. No chart library is in the stack.

## Options
For the history:
1. **AG Grid from `md:`, cards on phones.** Sorting and filtering for free, more visible use of the sponsor tool, same two-rendering rule as the evidence view.
2. **A plain HTML table from `md:`, cards on phones.** Lighter, but the sponsor tool goes unused where it fits.
3. **Cards at every size.** One rendering; a long history is hard to scan on desktop.

For the charts:
1. **AG Charts Community, lazy-loaded.** Same maker as AG Grid, matches the grid; MIT; roughly 150–200 KB gzipped, kept off first paint by loading when the charts scroll into view.
2. **Hand-drawn SVG.** No dependency, exact DESIGN.md look; no tooltips, ours to maintain.
3. **Recharts.** About 100 KB gzipped, generic look, no sponsor link.

## Decision
AG Grid (Community) for the payment history from `md:` up, cards below; AG Charts Community for the charts, loaded only when they scroll into view.

## Consequences
- `CLAUDE.md`'s stack row names the creator's payment history and adds AG Charts.
- Two dependencies, both lazy-loaded so a phone's first paint doesn't carry them.
- The history has two renderings over one list of rows; both tested.
- Every chart has a text equivalent; nothing is only in the chart.
- Open: whether AG Charts counts toward the AG Grid prize is for William to check in the hackathon's rules. If it doesn't, the charts still stand on their own; replacing them with SVG would be a new record.
