# No demo accounts: every creator signs in with Google

**Date:** 2026-10-11
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** [2026-10-10-demo-accounts-read-a-shared-channel.md](2026-10-10-demo-accounts-read-a-shared-channel.md) and [2026-10-11-demo-accounts-read-a-shared-instagram-account.md](2026-10-11-demo-accounts-read-a-shared-instagram-account.md); and, in part, [2026-10-08-creator-sign-in-through-the-backend.md](2026-10-08-creator-sign-in-through-the-backend.md): the demo account, which [2026-10-09-creators-sign-in-with-google-directly.md](2026-10-09-creators-sign-in-with-google-directly.md) had kept

## Context
A visitor could press "Try the demo account" and be signed in as a made-up creator of their own, so that a judge could use the product without connecting anything. For such an account to get through a deal, the backend carried a second way of doing several things: a made-up YouTube channel that reads through one real channel the team owns, a shared Instagram account to do the same for Reels, a sample clip to check in place of an upload, its own limits on briefs and drafts, a limit on how many one address can make, and a job that deletes each account after 7 days. The shared channel was not connected, the sample clip was not recorded, and the shared Instagram account was not built. Furqaan decided the backend should not carry demo accounts.

## Options
1. **No demo accounts.** Every creator signs in with Google and connects their own accounts. One kind of creator and one path through the code. A judge has no one-press way in.
2. **Keep them, as built.** A judge gets in with one press. The shared channel, the shared Instagram account and the sample clip have to be made, connected and kept working until judging ends.
3. **Keep the demo account, with stand-ins for YouTube and Instagram.** Nothing to set up, but the live check a judge sees is not real.

## Decision
Option 1.

## Consequences
- Removed from the backend: the route that makes a demo account, its limit per address and its clean-up job; the demo mark on the profile; the demo limits on briefs and drafts; the sample clip route; the shared demo channel and its setting. The shared demo Instagram account is not built.
- Demo accounts that exist when this is built are deleted with everything they made. Their money is the PayPal sandbox's and is left to the money path, which finishes it on its own timers.
- Without Google's credentials set, nobody can sign in. Local work on the pages needs them, or the mocks.
- William's sign-in and landing pages offer "Try the demo account" and call a route that will be gone. His sign-in and landing specs need a revision from him, and this overturns part of his own record, which that record allows.
- **How a judge runs the demo is open again, and has to be settled before submission.** The hackathon needs a demo judges can run. Without a demo account a judge needs a Google account that can sign in (while the Google app is in Testing, only its listed test users can), a YouTube channel of their own behind Google's warning for an unverified app, and cannot connect Instagram at all. This is for both leads.
- What capped a public demo's AWS bill now rests on the limits every creator has, the overall daily limits, and on who can sign in.
- Demo accounts can be brought back later without changing the money path.
