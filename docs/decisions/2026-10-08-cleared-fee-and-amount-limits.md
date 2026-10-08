# Cleared takes a 5% fee from the creator's payout; holds are $20 to $10,000

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan (William to review; William can supersede)
**Supersedes:** none

## Context
PRODUCT.md said the hold is captured to Cleared's PayPal account and "the amount" is paid out to the creator. It did not say who pays PayPal's charges on the capture and the payout, or whether Cleared takes anything. It also left open whether a hold could be captured straight to the creator's account. The money path spec cannot work out a payout without these. What each side is paid and charged is shared product behaviour; Furqaan decided so the money path can be specified.

## Options
What the creator receives:

1. **The full amount.** Cleared absorbs PayPal's charges and takes nothing. Simplest sums; would not hold with real money.
2. **The amount less PayPal's charges.** The creator cannot know the payout until PayPal reports its fee after capture.
3. **The amount less a Cleared fee.** Shows a business model; changes the terms both sides see.

Who bears the fee:

1. **The creator, from the payout.** The hold stays the deal amount, so the brand's page barely changes.
2. **The brand, on top of the hold.** The creator gets the full amount; every hold and total the brand sees grows.
3. **Split.** Changes both sides' screens and doubles the rounding.

The rate: 5% with PayPal's charges inside it; 10% with PayPal's charges inside it; or 5% with PayPal's charges on top.

## Decision
Cleared's fee is 5% of the deliverable's amount, taken from the creator's payout. PayPal's charges come out of that 5% and are not passed on. The fee is worked out in whole cents and rounded down. One hold is at least $20.00 and at most $10,000.00. The hold is captured to Cleared's PayPal account and then paid out; capturing straight to the creator is closed.

## Consequences
- The hold is still exactly the deliverable's amount (IN-BR-02 stands). A $1,200.00 post pays the creator $1,140.00.
- The fee rate and both limits are settings, not constants.
- PRODUCT.md's "How the money moves", "Limits in version one" and "Still open" are updated and point here.
- William's invite page must show the creator the fee and what they receive, and IN-FR-05's "Cleared sets no other ceiling" no longer holds. Both are listed under Requests for William in the money path spec; his specs are not edited by this record.
- Direct capture with a fee split in one step exists at PayPal only for approved partner accounts, which is out of reach for a sandbox build. That is why the open item is closed.
- Risk: by rough numbers, 5% does not cover PayPal's charges on amounts below about $50, so the $20.00 minimum loses money on small deals. No real money moves in the sandbox.
