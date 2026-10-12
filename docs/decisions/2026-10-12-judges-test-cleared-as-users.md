# Judges test Cleared as users do

**Date:** 2026-10-12
**Status:** Accepted (William); Furqaan to agree
**Decided by:** William
**Supersedes:** none. It settles the open item left by [2026-10-11-no-demo-accounts.md](2026-10-11-no-demo-accounts.md): how a judge runs the demo

## Context
There are no demo accounts. The hackathon asks for a demo that can be run, not a mockup. A judge has to sign in, play both sides of a deal, approve a PayPal hold, upload a draft and publish a post.

## Options
1. **As users.** A judge signs in with their own Google account and runs a deal end to end, as creator and as brand, on the hosted app and the PayPal sandbox.
2. **A judge kit.** Shared Google test accounts, sandbox logins and a sample video, with a script.
3. **A seeded deal.** A deal already set up on the hosted app, so a judge does only its last steps.

## Decision
Option 1. No accounts, data or paths are made for judges; the submission tells them what they need.

## Consequences
- **Google sign-in** must leave testing mode: the Google app is published (Furqaan). Its YouTube read-only scope is sensitive, and Google's verification would not finish before 12 November, so a judge sees Google's "unverified app" warning and continues past it, and the app takes at most 100 users. The submission says so.
- **YouTube.** A judge playing the creator connects a YouTube channel of their own and uploads the draft to it as unlisted.
- **Instagram** is for listed testers only, with no Meta review for the hackathon ([decision](2026-10-11-no-meta-review-for-the-hackathon.md)), so judges make YouTube posts unless added as testers.
- **PayPal sandbox.** The submission gives a sandbox buyer login for approving holds, and a sandbox email for the creator to be paid at. They are sandbox credentials only and go in the submission, never in the repo.
- **Both sides.** A judge opens the brand's link in a private window or another browser.
- **A judge guide** in the submission covers these steps. No frontend code changes.
