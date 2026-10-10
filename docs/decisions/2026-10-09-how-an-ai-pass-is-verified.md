# How an AI pass is verified before it counts

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
CLAUDE.md requires code to verify every AI pass: the cited timestamp exists, is inside the video, and matches the transcript or frame it claims. Three cases needed a concrete rule. Code cannot look at a frame, so a "shown" pass has nothing to be matched against. Speech-to-text may write a spoken code such as GLOW20 as "glow twenty". And timing items depend on a number in the item's wording and on arithmetic, which language models do unreliably.

## Options
1. **Shown items: a second, independent look.** Code cuts frames at the cited moment and asks Claude whether the thing is visible, without telling it what Nova said. Both must agree. The alternatives were timestamp checks only (a confident wrong answer passes) and never passing a shown item automatically (most drafts would never be fully passing).
2. **Spoken codes: a normalised match, and a near miss is unsure.** Case, spaces and punctuation are ignored and number words become digits. The alternatives were a strict match (a correctly spoken code fails on the transcriber's spelling) and letting the AI decide (breaks the rule that exact items are matched by code).
3. **Timing items: the AI finds the moments, code does the sum.** Claude returns the limit it understood and the start and end it means, quoting the words; code checks the quote and does the comparison. The alternatives were the AI deciding the whole item, and a number confirmed by the creator when the checklist is built (which changes deal set-up and two of William's pages).

## Decision
All three as described: the second look for shown items, the normalised match with near misses unsure, and code doing the sum for timing items.

## Consequences
- A shown pass needs Nova's moment inside the video and a "yes" from Claude on frames from it. A "no" or "cannot tell" makes the item unsure.
- A said or shown-as-text pass needs its quoted words found in the speech or on-screen text within two seconds of the cited time.
- A timing pass needs the limit to appear as a number in the item's own wording, the quote to be found, and code's comparison to hold. The AI never returns a result for a timing item.
- An exact item is never sent to a model. A near miss is unsure with the moment as evidence, so the creator can ask the brand to accept it.
- The service needs ffmpeg to cut frames, and one small image call to Claude for each shown item Nova passed.
- Not covered: a model that wrongly says "fix needed". There is no moment to verify, so the models are told to say it only when confident, and whether such an item can also be put to the brand is left to William's spec.
