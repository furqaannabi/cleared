# The first capture re-confirms a hold whose guarantee has ended

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
The money path spec had a refused capture tried again every 6 hours, re-confirming the hold first when PayPal allows it (MP-FR-25). The first capture (MP-FR-24) did not re-confirm. PayPal guarantees held funds for 3 days. A capture often comes later than that: after a fix window, after the brand's 48 hours on a live post the check could not decide, or when the creator published without a fresh go-ahead. A first capture on a lapsed guarantee is more likely to be refused, and a refusal costs the creator a 6-hour wait for a retry that would have done the right thing the first time.

## Options
1. **Re-confirm before the first capture too, when the guarantee has ended.** One rule for every capture. Adds a PayPal call before the capture in that case; if the re-confirmation fails, the try counts as refused and the retry rule applies.
2. **Leave it.** Only retries re-confirm. Simpler first call, slower payment whenever the guarantee has lapsed.
3. **Always re-confirm before any capture.** PayPal cannot renew a hold inside its guarantee, so this would add a status check that tells us nothing the capture itself would not.

## Decision
Option 1.

## Consequences
- MP-FR-24 gains the sentence (money path spec, revision 1.2). MP-FR-25 is unchanged.
- A capture inside the guarantee is still a single PayPal call.
- Whether PayPal accepts a renewal at that point, and whether it returns a new reference, is on the spec's "To verify in the sandbox" list; the new reference and guarantee are recorded when it does.
