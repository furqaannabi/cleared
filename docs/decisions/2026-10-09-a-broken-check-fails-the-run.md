# A broken check fails the whole run

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
A run calls three AWS services in turn: Bedrock Data Automation, Claude and Amazon Nova. Any of them can error, time out or be throttled part-way. Separately, a model can answer but give something that fails its schema or cannot be verified.

## Options
1. **A service failure fails the run; a bad answer makes one item unsure.** Nothing of a run with a failed service is shown. It is retried automatically, and only then reported as Cleared's problem. An answer that is malformed or unverifiable affects only its item.
2. **Show what finished and mark the rest unsure.** The creator sees something sooner, but unsure would then mean both "the AI could not tell" and "the AI never ran".
3. **Fail the run with no automatic retry.** Simplest, but a brief throttle becomes the creator's problem.

## Decision
Option 1.

## Consequences
- A run is all or nothing. A result is never "passing" because a check was skipped.
- A failed run is tried again up to 3 times with growing waits. After that the creator is told it is on Cleared's side and can start the same draft's check again.
- A failed run is not a run: the run number does not change and it does not count as one of the post's checks.
- Minutes already analysed still count towards the daily limit, because AWS has charged for them.
- "Unsure" keeps one meaning: the check ran and could not decide.
