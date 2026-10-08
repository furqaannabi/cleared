# A brand objection is settled by the creator and the brand

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** William (Furqaan can supersede)
**Supersedes:** none

## Context
PRODUCT.md says a brand objection during the review window "stops the clock and that deliverable moves to manual approval". It lists manual approval as still open: who decides, and what happens to the hold if nobody does before the deadline. The brand's review window (step 5) cannot be specified without an answer for objections: neither side's page could say what happens next. This is shared product behaviour. William decided so the frontend can be built; Furqaan can supersede it with a new record.

## Options
1. **The two sides settle it.** An objection names one item and carries a note. The deliverable then waits on the creator and the brand: the creator uploads a new draft that fixes it (a new draft check, and a new 48-hour window if every item passes), or the brand withdraws its objections, which approves the draft. If neither happens by the deliverable's deadline, the existing rule releases the hold to the brand. No Cleared staff, no admin screen.
2. **A person at Cleared decides.** Needs an operator screen, a promised response time and someone on hand during the demo. Too heavy for v1.
3. **The brand decides alone.** The brand approves anyway or releases the hold at once. Unfair to the creator: a brand could take its money back over taste.

## Decision
Option 1, for objections in the review window only. After publishing, the money path spec decides (MP-FR-18, MP-FR-19).

## Consequences
- PRODUCT.md's rule "A brand objection stops the clock" and its table row point here. Manual approval after publishing (the live check can't decide) is the money path spec's (MP-FR-18, MP-FR-19).
- The brand review FRD (RW) and the creator draft check FRD (DC 1.14) can specify the objected state on both sides.
- Risk accepted: a brand could object to run out the clock. Limited by every objection naming an item with a note, and by the creator keeping the time until the deadline to fix it.
- The backend needs objection and approval endpoints, an objected deliverable state that stops the window's timer, and the deadline release still running from that state (RW Requests for Furqaan).
