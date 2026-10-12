# A live Reel's video is read at most three times

**Date:** 2026-10-12
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
To match a live Reel to its approved draft, its video is fetched and its speech is read by Amazon Bedrock Data Automation, which is paid for by the minute. The Instagram Reels spec (IG-FR-26) said a check that could not read the video gives no answer and tries again with growing waits. A reading that keeps failing would then be tried about once an hour for as long as the hold lasts, up to three weeks: hundreds of paid readings for one Reel, and no answer for the creator in all that time.

## Options
1. **Three readings, then the brand looks.** After a third failed reading the video counts as one that could not be fetched, the live check answers "cannot decide", and the brand has its 48 hours to confirm or object. Spend is bounded at three readings a Reel.
2. **Keep trying, as signed.** No change. A Reel whose reading never works gets no answer until its deadline or day 28, and can cost tens of dollars.
3. **Three readings, then a person at Cleared.** Spend is bounded, but nothing exists for that person to act with, and the creator waits on them.

## Decision
Option 1.

## Consequences
- IG-FR-26 gains the limit. A failed reading is one Data Automation ended as failed, or one that ran past its time limit. A call that could not be made at all is not a reading and is not counted.
- Instagram failing, and the video failing to download, are still tried again without a limit. They cost nothing.
- The live check counts failed readings for a Reel. The count is kept with the check.
- "Cannot decide" here is for a video Cleared could not read, never for one it read and found wrong, so the rule that a seen fault is never softened still holds (IG-BR-06).
- The same answer is given for two cases the spec had not stated: a video larger than a draft may be, and a video of a kind the service does not read. Neither is called "not the approved file".
