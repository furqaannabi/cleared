# Requests and errors are logged by our own middleware, with ids only

**Date:** 2026-10-13
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
The API had no log of requests and no handler for an error a route did not handle. Such an error was answered with plain text, not the one error shape, and the whole error was printed to the log. An error from the database or from PayPal can carry what was sent or what came back, which the logging rule forbids. Furqaan asked for an error handler and a request log like morgan's.

Morgan is for Express, and the backend is Hono. A request log in morgan's usual form would also break two rules already signed. The brand's invite token is part of a path, and Google's and Instagram's one-time codes are in query strings, so a log of real addresses holds secrets. And the privacy decision says logs carry ids only, so no IP address and no user agent.

## Options
1. **Our own small middleware, ids only.** No new library. One line for each request: a request id, the method, the route's pattern, the deal's and post's id, the status and the time. An error handler answers in the one shape and logs the error's name, code and where it was thrown, never its message.
2. **Hono's built-in logger.** One import. It prints the real path, so every brand token would be logged, and it handles no errors. The logging rule and the privacy page would have to change.
3. **Add pino.** Structured lines and levels, useful if logs later go to a monitoring service. A new library, and the same rules about what to leave out would still be ours to write.

## Decision
Option 1.

## Consequences
- The deal set-up spec gains DS-FR-49 to DS-FR-51, and DS-BR-15 says what a log line never holds.
- Every answer carries an `X-Request-Id` header. The frontend can show it on its error page; the error shape does not change.
- An error's message is not logged, so a log line is terser than a stack trace: a name, a code and a place in the code. That is the price of never logging what a database or PayPal error carries.
- The health check is not logged. A path with no route is logged without the path.
- No dependency is added, and no log leaves the server. Sending errors to a monitoring service is still undecided.
