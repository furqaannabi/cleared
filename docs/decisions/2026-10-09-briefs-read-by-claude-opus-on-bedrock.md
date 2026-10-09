# Briefs are read by Claude Opus 5.5 on Bedrock, in one call, with limits

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
PRODUCT.md already says Claude on Amazon Bedrock reads the brief. Building it needs three more answers: which model, how the results reach the page, and what stops a public demo from running up a bill. Anyone can press "Try the demo account", and each read costs money. Bedrock offers Claude Opus 5.5, Claude Sonnet 5.5 and Claude Haiku 4.5 to this AWS account.

## Options
Model:
1. **Claude Opus 5.5.** The most capable. The checklist is the only thing a post is judged against, and money is held on it. About 10 cents a brief.
2. **Claude Sonnet 5.5.** Faster and about half the price. Not measured on a real brief.
3. **Claude Haiku 4.5.** Cheapest; an older generation.

How results arrive:
1. **All at once.** One call as a background job; the whole answer is checked before anything is shown.
2. **As they land.** Each finished item is saved while the rest is still being written. Nicer to watch, but a half-finished answer has to be checked and a late failure handled.

Limits:
1. **Per account and overall.** 20,000 characters a brief; 5 reads per demo account; 20 a day per creator; 300 a day across everyone.
2. **Per account only.** No overall stop, so demo accounts made in a loop are unbounded.
3. **Looser numbers.**

## Decision
Claude Opus 5.5, read all at once, with limits per account and overall.

## Consequences
- The model id and the AWS region are settings, so the model can change without a code change.
- The costs are estimates at Anthropic's list prices: about 5,000 tokens in and 3,000 to 4,000 out per brief. Bedrock's own prices may differ, and the real cost is to be measured on the first real brief.
- At the overall limit the worst case is about $30 a day.
- A read takes an estimated 20 to 40 seconds. The page shows a single "reading" state; William's line-by-line progress does not apply.
- Showing items as they land can be added later without changing the API, because the page already polls.
- The model's answer is constrained to a schema and checked again by the backend, every item must cite a real line of the brief, and the model has no tools.
- The limits are four settings.
