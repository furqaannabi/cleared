# Playwright runs live against a local backend, up to the brand agreeing

**Date:** 2026-10-12
**Status:** Accepted
**Decided by:** William
**Supersedes:** in part, [2026-10-11-frontend-on-the-live-api.md](2026-10-11-frontend-on-the-live-api.md) (Playwright runs against the live backend) and [2026-10-12-vitest-leaves-the-shared-mocks-before-playwright.md](2026-10-12-vitest-leaves-the-shared-mocks-before-playwright.md) (Playwright points at the live backend once the mocks go)

## Context
Furqaan's test session is built (AH-FR-25 to AH-FR-29): `POST /test/session`, with a secret in the `X-Test-Secret` header, signs in one fixed test creator with nothing connected. The 11 Playwright specs walk the whole deal on the shared mocks. Against a real backend, reading a brief is a Claude Opus call on Bedrock; a draft check runs Data Automation and Nova on a video, which costs real money each run; approving a hold needs a person to log in to PayPal's sandbox; and a live check needs a real post on a connected account. The hosted API answers only the hosted app's origin, so an app on `localhost` cannot use it.

## Options
1. **Up to agreeing, locally.** The live suite covers what is cheap and deterministic, against the developer's own backend; everything from the hold on stays covered by Vitest on stubs and is checked by hand in the sandbox.
2. **The whole deal, live.** PayPal sandbox credentials in CI, a video and a draft check each run, a connected YouTube account for the test creator. The most realistic, but a real AWS cost every run, and fragile.
3. **Only the pages with no model calls.** Free and fast, but no end-to-end check of the deal flow.

On where it runs: locally against the developer's backend; against the hosted app and API (tests only what is deployed, and writes test deals into the live database); or both from the start (needs the hosted app's address and the secret in CI first).

## Decision
Option 1, run locally.

## Consequences
- The live suite: sign in with the test session; Overview, Payments, Settings and the legal pages; a new deal through brief → checklist → invite → the brand opening its link and agreeing. At 375 px and 1280 px. One brief read per run.
- Playwright starts the app pointed at the local backend (`localhost:4000`). The backend has `TEST_SESSION_SECRET` set; Playwright reads the same secret from the environment (`web/.env.local`, ignored by git). The secret is never committed, logged or printed. Without it, the live specs are skipped, in CI too, until the hosted app's address is settled and the secret is in CI's secrets.
- From the hold to paid, the Vitest tests on per-test stubs are the automated cover; the whole deal is run by hand in the PayPal sandbox before the demo.
- Deleted with this slice: `web/src/mocks/`, `web/src/components/mocking/`, the mock-only hooks in the app's pages, `NEXT_PUBLIC_API_MOCKING`, the mock service worker and the mock media, and the e2e specs for the steps after agreeing.
