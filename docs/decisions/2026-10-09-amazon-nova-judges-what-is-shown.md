# Amazon Nova judges what is shown

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
PRODUCT.md left the video model open between TwelveLabs Pegasus and Amazon Nova, "to be chosen after testing both on a real sponsored clip". The draft check spec needs a model for "shown" items: the product visible and in use, a logo on screen. The account can already call Nova Pro and Nova 2 Lite, and both have quota above zero.

## Options
1. **Trial both first.** Run both on the same clip and choose with the numbers. The most informed choice, at the cost of days and a second model's set-up.
2. **Amazon Nova, now.** Amazon's own, no Marketplace offer to accept, and cheaper per minute on list price. Its timestamps on longer videos are less proven.
3. **TwelveLabs Pegasus, now.** Built for questions about video with timestamps. Needs a Marketplace offer, and the account's quota may be zero, as it was for Claude Opus 5.5.
4. **No video model in version one.** Shown items always come back unsure. Cheapest, but it removes the most visible use of AI on video.

## Decision
Option 2, without a trial.

## Consequences
- PRODUCT.md's "Still open" item for the video model is closed, and its "Built with" row and CLAUDE.md's name Amazon Nova.
- Pegasus is not used. Its reference stays in PRODUCT.md as the alternative that was considered.
- Which Nova model is a setting: Nova Pro to start with, compared with Nova 2 Lite on the team's recorded clips before it is fixed.
- Risk accepted: Nova was not tested first. A wrong pass is caught by the second look (see the record on how a pass is verified); poor timestamps would show up as more unsure items, not as wrong passes.
- The model sits behind a port, so changing it later is one adapter.
- The backend gains AWS's Bedrock runtime client to call it.
