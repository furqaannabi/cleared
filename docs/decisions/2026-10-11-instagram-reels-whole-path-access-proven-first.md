# Instagram Reels: the whole path in one spec, with Meta's access proven first

**Date:** 2026-10-11
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
Version one lists Instagram Reels, and nothing is built for them: a deal with a Reel is refused, and the three backend specs each leave Instagram out. Submission is 12 November. Everything a Reel needs after it is posted rests on fields Meta's API is said to return and nobody on the team has seen it return.

## Options
1. **The whole path, access proven first.** One spec for connecting, Reels in a deal, the go-ahead, posting and the live check with its match. The first step is a check by hand of what Meta's API returns.
2. **Without the automatic match.** Much less to build, but every Reel goes to the brand to confirm, and silence then pays for a Reel nobody matched to the draft.
3. **Connect and deals only.** Smallest, but a Reel deal could not finish, and nothing ships half done.

## Decision
Option 1.

## Consequences
- One spec, [Instagram Reels](../specs/instagram-reels-frd.md), prefix IG.
- Its first requirement is a by-hand proof against a real tester account. If a Reel's link, short code or video address does not come back as documented, the build stops and the spec is looked at again.
- The draft check, the review, the money path, the brand's decisions, cancelling and rulings are reused as built.
