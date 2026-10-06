# Frontend mocks are served with MSW

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
The frontend runs ahead of the backend, and there is no API contract yet. `CLAUDE.md` requires one typed API client in `src/lib/api/` and mocks that follow PRODUCT.md's terms, marked provisional. The creator draft check FRD needs time-based states to be mocked: a check running, results landing item by item, a check failing, an expired video URL. The same fixtures have to serve development, component tests and end-to-end tests.

## Options
1. **MSW (Mock Service Worker).** Mocks at the network layer. The client makes real requests and MSW answers in the browser, in Vitest and in Playwright. Switching to the real backend turns MSW off, with no change to the client. Scenarios can script states over time. Costs: one dev dependency, nothing in the production bundle, and a service worker file in `public/`.
2. **A mock implementation of the client**, chosen by an environment flag. No dependency, but the network path (requests, status codes, errors) goes untested until the backend exists, and Playwright needs its own mocks.
3. **Next.js route handlers as a mock API.** Real HTTP on the server, but fake backend code lives in `web/` and could be deployed by mistake.

## Decision
Option 1. Mocks are MSW handlers over synthetic fixtures, organised as named scenarios.

## Consequences
- MSW is a dev dependency only and is never enabled in a production build.
- Fixtures are synthetic and labelled synthetic on screen.
- Handlers follow the provisional shapes in each FRD and double as the frontend's write-up of what it needs from the backend. They are not the contract; the contract is agreed by William and Furqaan.
- Vitest and Playwright use the same handlers.
