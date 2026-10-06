# The creator can ask the brand to accept an Unsure item

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William (Furqaan can supersede)
**Supersedes:** none

## Context
PRODUCT.md says an item the AI is unsure about "goes to a person. The creator fixes it or the brand accepts it. It never clears on a timer." It does not say how the brand learns there is something to accept, or what happens to an acceptance when the creator uploads a new draft. This is shared product behaviour. William decided so the frontend can be built; Furqaan can supersede it with a new record.

## Options
1. **The creator asks the brand.** Each Unsure item has an "Ask {brand} to accept" action. The brand sees only that item and its evidence. The item shows "Waiting for {brand}" until they answer, and the creator can still upload a fix or withdraw the ask. Keeps the creator in charge and always says who has to act.
2. **Fix only.** The creator's one action is a new draft; how a brand accepts is left undefined. Simplest, but a judgment call can force a reshoot.
3. **Shown to the brand automatically.** Every Unsure item goes straight to the brand. Faster, but the brand sees draft problems the creator has not chosen to share.

For what happens to an acceptance after a new draft: it is either cancelled (the brand accepted a moment in the old video, not the new one) or carried over (less re-asking, but the brand approves footage it has not seen).

## Decision
Option 1, for Unsure items only, never Fix needed. A new draft cancels every open ask and every acceptance from the previous run.

## Consequences
- The creator draft check FRD's DC-FR-14 to DC-FR-18 and DC-BR-02 to DC-BR-04 can be built.
- An accepted item counts the same as Passed towards a fully passing draft; the API decides when the review window starts.
- The brand-side counterpart (accepting or declining an ask) belongs in the brand's spec.
- The backend needs ask and withdraw endpoints, an accepted status and a declined flag with the brand's note (listed in the FRD's Requests for Furqaan).
