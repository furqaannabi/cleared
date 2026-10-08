# Creators sign in with Google through the backend, which sets an HttpOnly session

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** William (Furqaan to review; Furqaan can supersede)
**Supersedes:** none

## Context
The stack names Cognito for sign-in, with Google and Instagram sign-in for connecting accounts, but not how the creator app signs in. CLAUDE.md requires sessions in HttpOnly cookies, never localStorage, and no tokens in the client bundle. The hosted demo also needs a way in for judges, who can't connect their own YouTube or Instagram accounts (PRODUCT.md "Risks to test first").

## Options
1. **The backend runs the sign-in.** "Sign in with Google" links to a backend route that redirects to Cognito's Google sign-in; Cognito returns to the backend, which sets an HttpOnly, Secure, SameSite=Lax session cookie and redirects into the app. The browser never holds a Cognito token. The backend needs a callback, a session store and a sign-out route.
2. **AWS Amplify in the browser.** Less backend work, but Amplify keeps Cognito tokens in browser storage by default, against the session rule, and puts auth logic in the client.

Sign-in providers: Google only (standard OpenID, supported by Cognito directly); email and password (passwords, resets, verification mail); email codes (needs SES); Instagram login (not an OpenID provider; custom work and Meta review just to create an account).

## Decision
Option 1, with Google as the only sign-in provider in v1. Instagram stays a connection made after signing in. A "Try the demo account" route signs a visitor into their own fresh copy of a pre-connected demo creator.

## Consequences
- New backend routes: start Google sign-in, the Cognito callback, sign out, the demo account; `GET /me` answers 401 when no one is signed in (SI Requests for Furqaan).
- Every creator route checks the session; brand routes keep the link session ([brand access](2026-10-08-brand-access-by-link-session.md)).
- The return path after sign-in is accepted only if it is a path on Cleared's own site.
- Demo copies are per visit and deleted after 7 days; they run on the PayPal sandbox like everything else.
- Risk: Google sign-ins made while the Google app is in "Testing" expire after 7 days; the app must be switched to "In production" before submission (PRODUCT.md).
