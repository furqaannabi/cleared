# The limits on drafts

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan (William to agree, as his pages show them)
**Supersedes:** none

## Context
Video analysis is billed per minute, the demo is public, and uploads pass through the one backend container. PRODUCT.md lists the cost as a risk and says the demo needs a cap on upload length and count. William's draft check spec left the length cap to Furqaan. The all-in cost is estimated at about 10 cents a minute and has not been measured.

## Options
1. **15 minutes and 1 GB, with a tight demo.** 10 checks per post, 300 minutes a day overall, and a demo account limited to 3 drafts of 3 minutes. Covers a normal sponsored video. About $30 a day at the estimate.
2. **Short only: 5 minutes and 500 MB.** Cheapest and safest for uploads, but a normal 10-minute YouTube video could not be checked.
3. **Generous: 30 minutes and 2 GB.** Covers almost any video, but one run could cost about $3, and 2 GB through the API is the fragile path.

## Decision
Option 1. Every number is a setting.

## Consequences
- A draft is an MP4 or MOV of at most 15 minutes and 1 GB.
- A post can be checked 10 times. A failed check does not count.
- No more than 300 minutes of video are checked in a day across everyone.
- A demo account can have 3 drafts checked, each at most 3 minutes.
- A draft refused for a limit is not analysed, and the answer says which limit and, for the daily one, when it resets.
- The real cost of a minute is measured on the first real runs, and these numbers are looked at again then.
