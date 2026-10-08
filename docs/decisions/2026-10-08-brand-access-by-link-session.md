# The brand gets in by its link, swapped for a deal-scoped session

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** William (Furqaan to review; Furqaan can supersede)
**Supersedes:** none

## Context
CLAUDE.md lists "How the brand is authenticated beyond the invite link" as not yet decided, owned by both leads. The brand's deal page can't be specified without it: it decides what happens on the first load. The brand is invited like a client receiving an invoice; it has no Cleared account. Every money step (approving a hold) already requires the brand to log in to PayPal.

## Options
1. **The link is the key, PayPal proves who pays.** Opening the link swaps its token for an HttpOnly session cookie scoped to that one deal, and the token leaves the address bar. No brand account in v1. Anyone holding the link before it expires can confirm the checklist or ask for changes; holds still need a PayPal login. Short path for the demo.
2. **Link plus an emailed code.** A six-digit code to the brand's email before anything shows. Stronger, but depends on SES (sandbox: verified addresses only), adds a step to the live demo, and fails when the creator gave no brand email.
3. **A brand account (Cognito sign-up).** Heaviest; against the invoice-like flow; out of proportion for v1.

## Decision
Option 1. The token is exchanged once for a deal-scoped HttpOnly session; there is no brand account in v1; the PayPal login guards the money. Option 2 can be added in front later without changing the page.

## Consequences
- CLAUDE.md's "How the brand is authenticated" row points at this record.
- The backend needs a token-for-session endpoint and a check on every brand route that the session belongs to that deal (CH Requests for Furqaan).
- The frontend never stores or logs the token; after the swap it moves to a URL without it.
- Several people can open the same link (each gets their own session); a link that doesn't work shows one message that names no one and gives no reason.
- Risk accepted: a forwarded link lets its holder agree to the terms or ask for changes until it expires. Expiry, the creator choosing who gets it, and the "Send it only to {brand}" warning limit it.
