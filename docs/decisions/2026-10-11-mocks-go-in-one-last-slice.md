# The shared mocks are removed in one last slice

**Date:** 2026-10-11
**Status:** Accepted
**Decided by:** William
**Supersedes:** in part, [2026-10-11-frontend-on-the-live-api.md](2026-10-11-frontend-on-the-live-api.md): when each surface's tests move to per-test stubs and its part of `web/src/mocks/` is deleted

## Context
The move onto the live API was to move each surface's tests to per-test stubs and delete its part of the shared mocks as that surface moved. Building the brief → checklist slice showed the surfaces share the mocks: the invite, confirm and hold, draft check and cancel pages, and their end-to-end tests, run on deals made by the brief → checklist mocks. Deleting a surface's mocks early breaks every later surface until it moves.

## Options
1. **Per slice, as decided.** Each slice deletes its mocks and moves all its tests. Later surfaces break, or get stop-gap fixtures, until they move.
2. **One last slice.** Each slice brings its surface in line with the contract and tests any new behaviour with per-test stubs. The remaining tests move to stubs, and `web/src/mocks/` and the mock-only controls are deleted, in one slice after the last surface.

## Decision
Option 2.

## Consequences
- Until the last slice, unmoved tests and the mock dev build keep running on the shared mocks, which follow the contract's shapes as each surface moves.
- The last slice comes after cancel: the remaining tests to per-test stubs, `web/src/mocks/` deleted except the MSW server Vitest uses, and the reset link, demo box, payout outcome choices and `/__demo` routes removed.
