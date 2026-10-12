# End-to-end tests get a session behind a secret, as one fixed test creator

**Date:** 2026-10-12
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none. It does not bring back the demo accounts removed by [2026-10-11-no-demo-accounts.md](2026-10-11-no-demo-accounts.md)

## Context
The frontend runs on the live API, and William's Playwright tests are to run against the live backend. Signing in needs a person at Google's screen, so no test can be signed in, and the shared mocks cannot be deleted until one can. A route that gives out a session without Google is a way round sign-in, in a public repo.

## Options
1. **A route behind a secret, for one fixed test creator.** The route exists only when a secret is set on the server. The caller sends it in a header. It can only ever sign in as one creator kept for tests.
2. **No route: a command prints a session.** Nothing new is public. But the session ends after 14 days unused and is re-made by hand, and a leaked value is a live session until then.
3. **Neither.** Playwright stays signed out. The full deal is never proven end to end automatically, and the mocks stay.

## Decision
Option 1, for the session only. A route to end a review window for tests was asked for and is left out: it moves a deal's clock and gets its own questions.

## Consequences
- `POST /test/session` is registered only when `TEST_SESSION_SECRET` is set and at least 32 characters long. Otherwise it answers as any path that does not exist.
- The secret is compared in constant time. A missing or wrong one gets the same answer as no route, and is logged as a denial without the value.
- The route takes no name, email or id. It signs in as one fixed test creator and nobody else, with the same cookie a Google sign-in sets.
- The test creator is an ordinary creator: the same limits, the PayPal sandbox, and no YouTube or Instagram connected by the route. It is not a demo account: nobody reaches it without the secret, and no page offers it.
- At most 120 sessions an hour are made this way.
- The secret lives in the server's environment and in CI's secrets. It is never in the repo, a log or an answer. **Risk:** whoever holds it is that one test creator, in the sandbox only. Changing the secret on the server shuts them out.
- A test runner sends no origin, so this one path is let past the origin check, as PayPal's webhook is.
- When this is built, William's last slice can delete `web/src/mocks/` and point Playwright at the live backend.
