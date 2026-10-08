# Before publishing: a 48-hour go-ahead, who can cancel, and posts that are never held

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan (William to review; William can supersede)
**Supersedes:** none

## Context
PRODUCT.md says Cleared re-confirms the hold before the creator publishes, and that a cancelled deal releases the hold. It does not say how long a re-confirmation is good for, what happens when PayPal cannot re-confirm, who can cancel or until when. The confirm and hold spec left open what happens when a brand agrees but never approves a hold, and its page will not offer a hold again while an attempt is pending or unknown, with no limit on how long that can last. All five concern a deliverable before anything is published, so they are recorded together. They are shared product behaviour; Furqaan decided so the money path can be specified.

## Options
How long a go-ahead lasts:

1. **48 hours.** PayPal guarantees re-confirmed funds for 3 days; this leaves a day for the live check and the capture.
2. **72 hours.** The whole guarantee; a late publish can be captured after it lapses.
3. **No limit.** A publish a week later is no better protected than with no re-confirmation.

When PayPal cannot re-confirm: tell the brand and let the creator ask again; have the brand approve a fresh hold; or release at once.

Cancelling a held deliverable:

1. **Either side, until the go-ahead.**
2. **The creator at any time, the brand until the go-ahead.**
3. **No cancel in version one.**

A post the brand never holds: closed after 7 days; waits with no limit; or the whole deal is cancelled.

A hold attempt with no final answer from PayPal: cancelled after 24 hours; after 1 hour; or never.

## Decision
1. A go-ahead to publish lasts 48 hours. After that the creator asks again and Cleared re-confirms again.
2. If PayPal cannot re-confirm, the creator is told not to publish, the brand is told to check its PayPal funding, the hold stays in place, and the creator can ask again. Still unconfirmed at the deadline, it is released like any deliverable with no post.
3. The creator or the brand can cancel a held deliverable while there is no go-ahead and nothing is published. During a go-ahead, and once a post is published, nobody can.
4. A post with no hold 7 days after the brand agreed is closed as not held. Posts already held carry on.
5. A hold attempt still pending or unknown after 24 hours is cancelled with PayPal, and the brand can try again.

## Consequences
- PRODUCT.md's Rules and "When something does not go to plan" are updated and point here.
- The confirm and hold spec's open item about a brand that never approves a hold is answered; William's pages need the "not held" state (Requests for William in the money path spec).
- Seven days matches the link's assumed expiry (IN-FR-17).
- The 48 hours is an upper limit. The money path spec proposes shortening or deferring a go-ahead when PayPal's guarantee is about to end and cannot be renewed yet; that detail is for sign-off with the spec.
- Risk: a brand could cancel in the moments after a go-ahead runs out while the creator has just published. The money path spec proposes checking for a published post before a go-ahead is allowed to end.
- Cancel buttons and the go-ahead's end time are not on any page yet.
