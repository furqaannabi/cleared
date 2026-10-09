# Creators sign in with Google directly, with no Cognito

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** [2026-10-08-creator-sign-in-through-the-backend.md](2026-10-08-creator-sign-in-through-the-backend.md), in part

## Context
William decided that creators sign in with Google through Cognito, with the backend running the sign-in and setting an HttpOnly session, and marked it for Furqaan's review. Everything in that record about the session, Google as the only provider and the demo account stands. One thing changes the picture for Cognito: to confirm a post is on the creator's channel, the backend needs read-only access to their YouTube account, and that means running Google's own sign-in with the creator, with a refresh token kept on the backend. Cognito's Google sign-in gives an identity but does not hand that access on cleanly, so a direct Google flow would sit beside it either way.

## Options
1. **Google directly, no Cognito.** The backend runs Google's sign-in itself: once for identity, and again with read-only YouTube access when the creator connects a channel. One integration, no user pool to create, and nothing changes for the pages.
2. **Cognito, as first decided.** Keeps the stack as written. A user pool and its Google client to set up, sign-out has to end the Cognito session too, and connecting YouTube still needs a second, direct Google flow.
3. **The demo account only, for now.** Fastest to a working flow, but leaves no real way in.

## Decision
Option 1. Google is still the only sign-in provider in v1, the session is still an HttpOnly cookie set by the backend, and the demo account stays.

## Consequences
- Cognito leaves the stack. PRODUCT.md's "Built with" and CLAUDE.md's stack table say so.
- The earlier record stands except where it names Cognito: the callback is Google's, and sign-out ends only Cleared's session.
- The backend verifies Google's signed identity token itself and keeps the sessions in Postgres.
- A Google Cloud OAuth client is needed: its id and secret, and the callback addresses. Furqaan sets it up.
- The risks in PRODUCT.md still apply and are now the backend's to handle: an unverified Google app is capped at 100 users and shows a warning for the YouTube access, and sign-ins made while the app is in "Testing" expire after 7 days.
- William's sign-in spec mentions Cognito in its requests; the page does not change. He has to agree, since sign-in sits between both areas.
