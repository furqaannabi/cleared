# Backend tests: Bun's test runner, a real Postgres and a fake PayPal

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
`CLAUDE.md` requires every feature to be test-driven and lists backend test tooling as undecided. The first backend feature is the money path, where the things most worth proving are that a step runs once under row locks and that an unclear PayPal answer is never acted on twice.

## Options
1. **Bun's test runner, a real Postgres, a fake PayPal.** No new dependency. Tests run against the Docker Postgres, with PayPal replaced by a fake behind the [PayPal port](2026-10-08-paypal-client-sdk-behind-port.md) that can decline, time out or answer twice on demand. A small separate suite calls the real sandbox and is run by hand and before release.
2. **Vitest, a real Postgres, a fake PayPal.** One runner across the repo, since `web/` uses Vitest. It runs on Node, so tests would not exercise the Bun runtime the service runs on.
3. **Bun's test runner, everything against the sandbox.** Proves the real thing every time, but slow and flaky, unable to produce a timeout or a duplicate webhook on demand, and unable to test renewing a hold, which needs one more than 3 days old.

## Decision
Option 1.

## Consequences
- Backend tests need the Docker Postgres running; a test database is kept apart from the development one.
- The fake PayPal is part of the test code and is never built into the service.
- The sandbox suite needs sandbox credentials in a local, gitignored environment file and at least one hold created days earlier.
- Tests are named after the FR or BR they prove, as in `web/`.
- There is no backend CI yet; adding it means a Postgres service in the workflow and is a separate change.
- `CLAUDE.md`'s "Not yet decided" row for backend test tooling is closed.
