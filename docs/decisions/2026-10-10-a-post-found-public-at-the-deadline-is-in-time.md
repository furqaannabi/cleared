# A post found public when Cleared asks at the deadline is in time

**Date:** 2026-10-10
**Status:** Accepted
**Decided by:** Furqaan (William to review; William can supersede)
**Supersedes:** none. It settles how the first decision in [What ends a hold once a post is published](2026-10-08-what-ends-a-hold-after-publishing.md) is applied; that record stands.

## Context
At the deadline a hold is released only if no approved post was published in time. A post counts as published from the moment Cleared first sees it public on the creator's channel ([publish to paid](../specs/publish-to-paid-frd.md), PT-FR-10), and when the creator has not said "I've posted it", the first time Cleared looks is when the money path asks at the deadline. That question is always answered a moment after the deadline. The money path compared the moment the post was seen with the deadline, so a video public for days was seen "late" and its hold was released. Found while building the live check: a video made public four days early and first seen five seconds after the deadline ended as released.

## Options
1. **A post found public when the money path asks at the deadline is in time.** The money path stops comparing times at the deadline: published when asked, or recorded as published before, keeps the hold. One rule, in the place that releases holds.
2. **The answer is capped at the deadline.** The publishing module reports the deadline itself as the time. The money path is untouched, but the recorded time is no longer when Cleared saw the post, and the module that reads YouTube has to know a money date.
3. **Leave it.** A post counts only if the creator says so, or a go-ahead's end catches it, before the deadline. A creator who publishes on time and forgets to tap loses the payment.

## Decision
Option 1.

## Consequences
- MP-FR-22 changes: at the deadline the hold is kept if an approved post is published when the question is answered. Only a post not published then releases it.
- The time recorded for the post stays the moment Cleared first saw it public. It can be a moment after the deadline for a post that kept its hold.
- If the question cannot be answered at the deadline, because YouTube is failing, it is asked again until it can be. A video made public in that gap also counts as in time. This is rare and favours the creator; it is accepted.
- A creator whose channel Cleared cannot read at the deadline is still seen as not published, and the hold is released ([Lost YouTube access decides nothing](2026-10-10-lost-youtube-access-decides-nothing.md)).
- The money path's test that a post seen after the deadline loses its hold is replaced by the opposite.
