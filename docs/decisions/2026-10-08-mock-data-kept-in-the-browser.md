# Mock data is kept in the browser in a mock build

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
The MSW mocks (2026-10-06-frontend-mocks-msw.md) keep their synthetic data in the page's memory. Any full page load, typed address or new tab starts again from the seed. Confirm and hold is the first flow that moves between two sides (the creator's pages and the brand's page, which has no rail), so trying it naturally means typing an address or reloading, and the brand's notes vanished from the creator's side.

## Options
1. **Keep the mock data in the browser.** In a mock build, the mock API saves its data to this browser's localStorage after every mocked response and reads it back before a request when another load or tab has saved since. Reloads, typed addresses and tabs all see the same deal. A mock-only "Reset demo data" in the deals list puts the seed back.
2. **Only add a way back.** A mock-only link from the brand's page to the creator's. Smallest, but any reload or new tab still loses everything.
3. **Both.**

## Decision
Option 1.

## Consequences
- Only in a mock build (development with mocking enabled); Vitest and production builds never load it. MSW still never ships in production.
- Only synthetic data is stored. The brand "session" in it is the mock's stand-in for the backend's HttpOnly cookie, not a real session or token; CLAUDE.md's "never localStorage" rule for sessions still holds for everything real.
- Each mock module exposes its data for a snapshot; a snapshot of another version, or one that doesn't parse, is ignored and the seed stays.
- Playwright runs in fresh browser contexts, so tests still start from the seed.
