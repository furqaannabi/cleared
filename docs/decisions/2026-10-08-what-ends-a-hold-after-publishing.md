# What ends a hold once a post is published

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan (William to review; William can supersede)
**Supersedes:** none

## Context
PRODUCT.md says a passing live check captures the hold and a missed deadline releases it. It left two items open: who decides when a deliverable goes to manual approval and what happens to the hold if nobody does, and whether a creator can fix a live check failure that is still fixable. It also did not say what "missed" means when a post is published minutes before the deadline, or what happens when PayPal refuses a capture. PayPal ends a hold after 29 days whatever Cleared does. These are five answers to one question, so they are recorded together. They are shared product behaviour; Furqaan decided so the money path can be specified.

## Options
The deadline:

1. **Published in time.** Release only if no approved post was published by the deadline.
2. **Paid in time.** Release unless already captured. One timer, but a post published late on the last day loses its payment.
3. **Published, plus a grace day.** Moves the date the brand agreed to.

A live check that cannot decide:

1. **The brand, and silence pays.** 48 hours to confirm or object; an objection goes to a person at Cleared.
2. **The brand must confirm.** Brings back the creator who posted and waits.
3. **A person at Cleared.** Every such deliverable waits on the team.

A live check that fails on something fixable:

1. **A fix window, then release.** Until the deadline, or 24 hours after the failure if later.
2. **Fix only until the deadline.** No chance for a creator who publishes on the last evening.
3. **Any failure goes to the brand.** Hands the brand a reason not to pay over a typo.

Still undecided when PayPal is about to end the hold: release on day 28, or capture and keep the money until someone rules.

A refused capture: keep trying to day 28 and tell both sides; also let the brand pay again; or give up on the first refusal.

## Decision
1. At the deadline, a hold is released only if no approved post was published in time.
2. When the live check cannot decide, the brand has 48 hours to confirm or object with a reason. Confirming or silence captures the hold. An objection goes to a person at Cleared, who rules to pay or to release.
3. When the live check fails on something fixable, the creator can fix it and have it checked again until the deadline, or until 24 hours after the failure was reported if that is later. Still failing then, the hold is released.
4. Any hold neither captured nor released on day 28 is released.
5. A capture PayPal refuses is tried again until day 28, with both sides told. If none succeeds, the deliverable ends as approved, not paid.

## Consequences
- "Manual approval" and "A live check that fails on something still fixable" leave PRODUCT.md's "Still open". Its Rules and "When something does not go to plan" are updated and point here.
- The rule "payment follows the live check with no second wait" still holds for a passing live check. A live check that cannot decide adds at most 48 hours.
- Capturing on day 28 was rejected because it would take the brand's money before a passing check, against the locked rule that money is captured only after one.
- A failure that cannot be fixed (the wrong account, a different video) gets no fix window. The money path spec proposes that the brand may accept it within 48 hours and that silence does not pay; that detail is for sign-off with the spec.
- Risk accepted: a creator can be left unpaid for a live post if the brand objects and nobody at Cleared rules by day 28, or if PayPal never lets the capture through. Both end with a stated reason.
- The brand's page after publishing, the fix window on the creator's page and a way for Cleared to rule are not specified yet (Requests for William in the money path spec).
