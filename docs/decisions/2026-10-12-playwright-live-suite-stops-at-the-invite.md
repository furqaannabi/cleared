# The live Playwright suite stops at the invite until the test creator can have an account

**Date:** 2026-10-12
**Status:** Accepted
**Decided by:** William
**Supersedes:** in part, [2026-10-12-playwright-live-suite-local-backend-up-to-agreeing.md](2026-10-12-playwright-live-suite-local-backend-up-to-agreeing.md): how far the deal goes, and which dev server Playwright uses

## Context
The live suite was to run a new deal up to the brand agreeing. The test session connects no YouTube or Instagram account (AH-FR-28), and the brand's link can't be made until the account a post goes on is connected (IN-FR-16, IN-FR-23); connecting needs a real Google or Instagram sign-in, which a test can't do. Separately, the local backend answers only its `APP_ORIGIN`, `http://localhost:3000`, which is the developer's own dev server.

## Options
1. **Up to the invite now; ask Furqaan for a stand-in account.** The deal runs to the invite, where Create link is held back with "Connect YouTube"; the brand's half is added once the test session can come with a stand-in YouTube account.
2. **Wait for Furqaan.** Nothing half-done, but with the mocks gone Playwright has nothing to run meanwhile.
3. **Make the link through the API.** Not possible: the backend refuses it without a connected account too.

## Decision
Option 1.

## Consequences
- The live suite covers sign-in with the test session, Overview, Payments, Settings and the legal pages, and a new deal through brief → checklist → invite, checking the link is held back until YouTube is connected.
- Playwright uses the dev server on `localhost:3000`, reusing the developer's running one, since that is the origin the local backend answers.
- A request for Furqaan: the test session, and only it, can come with a stand-in YouTube account connected (for example `{ "youtube": true }` in its body). When it can, the suite goes on to the brand opening its link and agreeing.
