# The brand holds with a PayPal account or a card, and nothing else

**Date:** 2026-10-13
**Status:** Accepted (William); Furqaan to agree
**Decided by:** William
**Supersedes:** none

## Context
On the hosted sandbox run, PayPal's button showed its defaults: "PayPal", "Debit or Credit Card", and Pay Later in PayPal's window. Cleared never chose these. Every hold has to be re-confirmed just before the creator publishes, captured up to 21 days after it is made (a hold lasts 29 days), or released; a way to pay that can't do all three would leave a creator who published unpaid.

## Options
1. **PayPal account only.** Card, Pay Later, PayPal Credit and Venmo off. Every hold is a PayPal-account authorization, the case the hold rules were written for. A brand without a PayPal account can't pay.
2. **PayPal account and card.** Pay Later, PayPal Credit and Venmo off. A brand without a PayPal account pays by card as a guest. Whether a guest card hold can be re-confirmed and captured as late as a PayPal-account hold is not yet verified.
3. **PayPal's defaults.** Everything PayPal offers, Pay Later and Venmo included, with the same unknown and more of it.

## Decision
Option 2. The brand approves each hold with a PayPal account or a card; Pay Later, PayPal Credit and Venmo are turned off on PayPal's button.

## Consequences
- **Must pass before the demo (Furqaan):** in the sandbox, a hold approved by guest card is re-confirmed after a few days and captured after a week. If any of the three fails, card is turned off (option 1), one setting on PayPal's button, and a new record supersedes this one.
- The brand's deal page shows PayPal's two buttons, "PayPal" and "Debit or Credit Card"; the card form opens inside the page ([confirm and hold FRD](../specs/confirm-and-hold-frd.md) CH-FR-17, 1.9).
- The hold stays `intent=authorize` either way: approving reserves the money and takes nothing.
- No backend change: the order, its approval and closing use the same routes.
