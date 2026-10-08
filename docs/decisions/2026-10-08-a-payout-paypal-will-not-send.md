# A payout PayPal will not send is retried and put in front of Cleared

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
The first real payout sent to the sandbox was refused outright: the business account behind the app was not allowed to send payouts. The money path spec had outcomes for a payout that is unclaimed, failed, returned, blocked or denied, which are all results of a payout PayPal accepted. It had none for a payout PayPal will not send at all. The port reported it as "unknown", so the money code would have checked it forever and told nobody. The same would happen in real use if Cleared's PayPal balance ran short. In every such case the hold is already captured, so the money is in Cleared's account and owed to the creator.

## Options
1. **Send the same payout again on a schedule, and tell a person at Cleared.** The cause is fixed outside the app, by topping up the balance or fixing the account, and the payout then goes without anyone pressing a button. Each retry uses the same request id, which PayPal never sends twice.
2. **A person at Cleared sends it again by hand.** No timer, but every such creator waits on Furqaan or William, and it needs a way to do it.
3. **Treat it like a failed payout.** The creator is told to correct their PayPal email and send it again. Wrong advice: the creator has done nothing wrong and cannot fix it.

## Decision
Option 1. The payout is sent again every 6 hours under the same request id, with no end date. A notice is recorded for a person at Cleared at the first refusal, and one for the creator saying the payout is delayed on Cleared's side and there is nothing they need to do.

## Consequences
- The money path FRD gains MP-FR-45 (revision 1.3).
- The PayPal port's answer to sending a payout gains "refused". A refusal is a 400, 403 or 422 answer that names an error and does not concern a payout already sent under that id. A rejected log-in, a rate limit, a server error and no answer stay "unknown".
- The retry has no end date, unlike a refused capture, which stops at day 28 because the hold ends. Here stopping would strand money that is owed.
- The creator cannot ask for the payout to be sent again while it is being retried (MP-FR-30 allows that only after a payout has ended unpaid).
- The creator's page needs a state for a payout delayed on Cleared's side. It is a new item for William, alongside the other payout states that have no page yet.
- Risk accepted: PayPal could refuse for a reason that is the creator's after all, such as an address it will never pay. The creator would then be told to wait when they should act. The notice to Cleared is what catches it.
