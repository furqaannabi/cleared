# Email for the brand's two notices after publishing, to an address the brand gives

**Date:** 2026-10-10
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none

## Context
After publishing there are two moments when the brand has 48 hours to act: when the live check could not decide (silence pays the creator), and when the post failed on something that cannot be fixed (silence returns the money). Nothing in Cleared sends email ([2026-10-09](2026-10-09-no-email-yet-the-creator-sends-the-review-link.md)), so the brand would only learn of either from a link the creator sent. In the first case the creator gains if the brand never finds out. The only brand address Cleared has is an optional one the creator typed.

## Options
1. **Email for these two notices, to an address the brand gives when it agrees.** Through Amazon SES. If the brand gave none, the address the creator typed; if neither, the creator is shown the link to send.
2. **The creator sends the link, as for a draft review.** No new service, but where silence pays the creator, the creator has every reason not to send it.
3. **The 48 hours start when the brand opens the link.** Fair without a new service, but a creator could wait up to four weeks, and it changes a locked money rule.
4. **Use the email on the brand's PayPal account.** Verified by PayPal, but it means keeping a field from PayPal's payload the money path does not keep, and using a payment address for another purpose.

## Decision
Option 1.

## Consequences
- Amazon SES joins the stack, for these two notices and nothing else. The earlier record stands for everything else: the invite and a draft review are still sent by the creator.
- When the brand agrees to the terms its page asks, optionally, for an email for anything that needs it after the post is live. It is never shown to the creator.
- A notice goes to the brand's own address, else the one the creator typed, else none is sent and the creator's post carries the link to send.
- The email is plain text: which post, what is asked, until when, and a fresh link. It is sent once for each window.
- SES needs a verified sender. Until AWS grants production access it delivers only to verified addresses, which is enough for the demo and not for real brands.
- The address and the link are never logged.
- Risk that remains: a brand that gave no address and whose creator typed none is told only by the creator.
