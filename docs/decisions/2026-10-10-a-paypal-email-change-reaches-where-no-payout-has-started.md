# A PayPal email change reaches every deliverable where no payout has started

**Date:** 2026-10-10
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
Deal set-up says changing the PayPal email also changes where the payout goes for every deliverable of the creator's that is not yet paid (DS-FR-10). It was left unbuilt, because until deals could be agreed no deliverable had money. One case needed a rule: a payout already sent to PayPal and being retried reuses the same request id, so changing the email under it is unsafe.

## Options
1. **Change it wherever no payout has started.** A payout already with PayPal keeps its email; the creator is told which posts those are.
2. **Refuse the change while a payout is in flight.** Nothing is ever ambiguous, but a creator who spots a typo must wait hours.
3. **Change it everywhere, including in flight.** What DS-FR-10 says literally, but it needs new payout rules: cancel and re-send under a new request id.

## Decision
Option 1.

## Consequences
- Saving a new PayPal email updates every deliverable of the creator's whose payout has not been sent to PayPal.
- A payout that is with PayPal keeps the email it went to. If it ends unpaid, the next try uses the new email, as the money path already does (MP-FR-28).
- The profile's answer says which posts keep the old email.
- DS-FR-10 is read this way from now on. The money path's rules do not change.
