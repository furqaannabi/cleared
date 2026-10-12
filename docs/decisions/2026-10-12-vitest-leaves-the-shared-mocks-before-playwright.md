# Vitest leaves the shared mocks before Playwright does

**Date:** 2026-10-12
**Status:** Accepted
**Decided by:** William
**Supersedes:** in part, [2026-10-11-mocks-go-in-one-last-slice.md](2026-10-11-mocks-go-in-one-last-slice.md): the last slice is split in two

## Context
Every surface is on the live API, and the last slice was to move the remaining tests to per-test stubs and delete `web/src/mocks/` and the mock-only controls. It was held back because Playwright needs Furqaan's test-session route to run against the live backend. Only Playwright needs that route: its 11 specs run on the dev server with the mocks on in the browser, and drive the mock-only controls (the demo PayPal approval, the outcome choices, the `/__demo` routes). The 54 Vitest files that still use the shared mocks do not need it.

## Options
1. **Vitest moves now; Playwright keeps the mocks until the route.** Every Vitest test moves to per-test stubs; the mock dev build and its controls stay for Playwright alone. No Playwright spec is written twice.
2. **Everything goes now.** The 11 specs are rewritten on per-test `page.route` stubs, with stateful stubs for the long flows, and the mocks and controls are deleted. They would be rewritten again for the live backend.
3. **Only the app's controls go.** The Playwright flows that need them are dropped or skipped until the live suite, losing end-to-end coverage of the deal flow meanwhile.

## Decision
Option 1.

## Consequences
- One surface per commit, in deal-flow order: sign-in and welcome, brief → checklist, invite, confirm and hold, draft check, brand review, publish and pay, cancel, then the shell, home and Settings. The suite is green after each.
- Typed fixture builders and small stateful stubs live in `web/src/test/`, as `anInvite`, `aProfile` and `stubSession` do. Test names and the behaviour they prove stay; only the setup changes.
- A test that asked the shared mocks what changed checks instead what the page sent (or did not send) and what it shows.
- Tests of mock-only behaviour move next to the mocks (`web/src/mocks/`, `web/src/components/mocking/`) and go when they go. A page test that only exercised the mock wiring is dropped when a stubbed test covers the same behaviour.
- The last commit gives Vitest an empty MSW server that fails any request without a stub, with no mock data to reset. The mocks' own tests keep their own server with the handlers.
- The mock dev build and its controls stay, for Playwright only, and never in a production build. When Furqaan's test-session route exists, `web/src/mocks/` and the controls are deleted and Playwright points at the live backend.
