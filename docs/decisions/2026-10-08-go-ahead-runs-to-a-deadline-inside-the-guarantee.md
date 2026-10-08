# A go-ahead runs to the deadline when the deadline falls inside PayPal's guarantee

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
The money path spec (MP-FR-13) stops a go-ahead 24 hours before PayPal's 3-day guarantee ends, so the live check and the capture finish while the funds are guaranteed. When that leaves no time, the creator is told to wait until the guarantee ends and PayPal can renew the hold. Building it showed a gap: with a 2-day deadline, the deadline falls before the guarantee ends. A creator who asks in the last hours before that deadline was told to wait until a time after it, could never get a go-ahead, and the hold was released for a missed deadline.

## Options
1. **Run to the deadline.** When the deadline falls before the guarantee ends, drop the 24-hour margin: the go-ahead lasts 48 hours or until the deadline, whichever is sooner. The funds are guaranteed past the deadline. A post published just before it can leave less than 24 hours for the live check and capture inside the guarantee.
2. **Keep the margin.** The creator with a short deadline loses the last hours before it and must ask earlier. Nothing changes in the rules, but the creator is locked out by a limit they cannot see.
3. **Shorten the margin for everyone.** For example 6 hours instead of 24. Narrows the gap without closing it, and gives every go-ahead less room for the live check.

## Decision
Option 1.

## Consequences
- MP-FR-13 gains the exception (money path spec, revision 1.1). It builds on the [go-ahead decision](2026-10-08-go-ahead-cancel-and-unheld-posts.md), which stands.
- When the exception applies, the answer is never "wait until".
- Risk accepted: a capture for a post published close to such a deadline can land after the guarantee. If PayPal refuses it, the retry rule (MP-FR-25) applies.
- Deadlines of 3 days or more are unaffected unless the hold was approved late enough in the creator's day for the deadline to fall before the guarantee ends; the same rule covers that case.
