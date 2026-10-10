# Test clips are recorded by the team

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none

## Context
CLAUDE.md requires a golden set of real sponsored clips with expected results per item to test the AI checks. The public demo also needs a video a judge can check without uploading one. Downloading creators' videos from YouTube breaks its terms, and the repo is public.

## Options
1. **The team records them.** Four to six short clips filmed on a phone with a made-up product, each scripted to hit or miss specific items. Kept in the bucket, not the repo.
2. **Recorded, and committed to the repo.** Anyone could run the golden test, but it adds video to git for good and the team's faces to a public repository.
3. **Generated or stock footage.** No filming, but unlike real creator videos, so it proves less and the demo is less convincing.

## Decision
Option 1.

## Consequences
- Each clip has a written list of the expected result for every item. The lists are in the repo; the videos are not.
- The golden test is run by hand, like the PayPal sandbox suite, because every run costs money.
- The clips cover at least: a code said correctly, a code said wrong, a code on screen, a product shown in use, a product never shown, and a mention that comes too late.
- One clip is the sample a demo account can check with one press.
- Furqaan and William record them before the checks can be measured.
