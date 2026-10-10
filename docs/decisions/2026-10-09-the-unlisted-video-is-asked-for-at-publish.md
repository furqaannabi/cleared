# The unlisted YouTube video is asked for at publish, not at the draft check

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none

## Context
PRODUCT.md says a YouTube draft is the file plus the same video uploaded to the creator's channel as unlisted, so the live post can be tied to the draft. William's draft check page has a failure for a file that is not the same video as the unlisted upload. Checking that needs the creator's real Google connection, which is not set up, and demo accounts have a made-up channel.

## Options
1. **Leave it to the publish spec.** The draft check takes the file alone. The unlisted video's link is asked for when the creator says they are ready to publish, and matched to the approved file there, where the YouTube work for the live check is built anyway.
2. **Include it now.** Closest to PRODUCT.md as written, but it cannot be tested until the Google client exists, and demo accounts need a pretend path.
3. **An optional link now, checked later.** Lets the field be built now, but it does nothing yet.

## Decision
Option 1.

## Consequences
- A draft is the file. The draft check never refuses a file as not the same video.
- The approved draft's file, with its size and length, is kept until the post ends, so the publish step can tie the live post to it.
- PRODUCT.md's Platforms table still describes the whole of how a YouTube draft is tied to the live post; when in a deal the unlisted video is asked for is set here.
- William's `not_same_video` failure is not used by this step.
