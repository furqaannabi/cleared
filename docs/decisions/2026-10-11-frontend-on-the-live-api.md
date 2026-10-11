# The frontend runs on the live API; tests stub their own requests

**Date:** 2026-10-11
**Status:** Accepted
**Decided by:** William
**Supersedes:** in part, [2026-10-06-frontend-mocks-msw.md](2026-10-06-frontend-mocks-msw.md): the shared mock backend for development and Playwright

## Context
The frontend was built ahead of the backend on MSW handlers over synthetic fixtures, shared by development, Vitest and Playwright. The backend is now live at `https://hack.furqaannabi.com`, and the API contract is generated from its schemas into `contract/` ([API contract generated from Zod](2026-10-09-api-contract-generated-from-zod.md)). With [no demo accounts](2026-10-11-no-demo-accounts.md), the mock-only ways in (the demo account, the mock accounts) no longer match anything real. The live backend trusts one app address only (`appOrigin`): it refuses a changing request from any other origin, returns Google sign-in there and builds links on it ([app and API on one domain](2026-10-09-app-and-api-on-one-domain.md)).

## Options
What the frontend runs against:
1. **Dev and the hosted app on the live API, tests keep MSW.** Tests stay deterministic; the mock-only extras go.
2. **The live API everywhere, tests included.** No fake backend to keep in step; end-to-end tests are slower and need a way to sign in that isn't Google's page.
3. **Mocks kept as a second mode behind a flag.** Works offline; every page has two backends to keep in step.

What component tests run against:
1. **Per-test stubs.** Each test answers only the requests it makes, typed from the contract. Keeps CLAUDE.md's "components with mocked API" and fast tests of loading, error and Try again.
2. **No stubs.** Components take props; anything that fetches is covered only end to end. Needs a CLAUDE.md change and loses the fast failure-state tests.

Where local development gets its API:
1. **A local backend** on `localhost:4000` (Docker Postgres and Bun), the live one for the hosted app. Cookies, origin checks, Google and links work unchanged; needs sandbox Google and PayPal credentials in the local `.env`, shared privately.
2. **The live backend also trusts `localhost:3000`.** Convenient, but local work writes to the shared live database and the live server trusts a second address.
3. **No local server.** Every change checked on the hosted app after a deploy.

Where the move sits:
1. **Next on the roadmap, before Settings, one surface at a time in deal-flow order.**
2. **Settings first, then the move.**
3. **Everything in one sweep.**

## Decision
The live API everywhere (option 2). Component tests stub their own requests, typed from the contract (option 1). Local development runs a local backend; the hosted app uses the live one (option 1). The move is the next roadmap step, before Settings, one surface at a time in deal-flow order: sign-in and welcome, brief to checklist, invite, confirm and hold, draft check, review, publish and pay, cancel (option 1).

## Consequences
- `NEXT_PUBLIC_API_BASE_URL` is `http://localhost:4000` locally and `https://hack.furqaannabi.com` on the hosted app.
- The shared mock backend in `web/src/mocks/` (its store, timers, persistence, the `/__demo` routes) is deleted a surface at a time, with the mock-only controls: the rail's reset link, the demo box, the payout outcome choices.
- Each surface's hand-written response schemas give way to the contract's types; Zod still checks every response at runtime (CLAUDE.md "Input"). Where a page needs something the contract lacks, it goes to Furqaan, as before.
- Vitest keeps MSW as the tool for per-test stubs; it is never in a production build.
- Playwright runs against the hosted app and the live backend. It can't sign in through Google's own page, so signed-in runs need a test-only way to get a session from the backend, accepted only with a secret held in CI. That is Furqaan's to decide; until then live end-to-end covers signed-out pages only.
- Every live run writes to the live database and the PayPal sandbox.
- CLAUDE.md's "Frontend mocks" row, its API calls note and its frontend testing row change to match.
