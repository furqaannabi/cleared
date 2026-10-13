# A failed job is logged at once, and kept, without its message

**Date:** 2026-10-13
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none. It carries [2026-10-13-requests-and-errors-are-logged-by-our-own-middleware.md](2026-10-13-requests-and-errors-are-logged-by-our-own-middleware.md) over to jobs

## Context
Requests are now logged with ids only, and an error is logged by its name, its code and where it was thrown. Jobs were left as they were: a job that finished or waited logged nothing, and a job that failed logged nothing until it gave up, after twelve failures, which can be hours later. Meanwhile each failure's message was stored in the jobs table. A message from the database or from PayPal can carry an email or part of an answer, and the table is not cleared when an account is deleted. Furqaan asked for jobs to be logged too.

## Options
1. **Every run logged; the table keeps the name, code and place.** A line each time a job runs, and each failure at once. A draft being checked asks after its reading every 10 seconds, so one draft adds about twenty lines.
2. **Failures only; the table keeps the name, code and place.** The log stays quiet: no line for a job that finishes or waits. Each failure is logged at once in the same safe form.
3. **Every run logged; the table keeps the message.** The message is the most useful thing for a stuck job, and the place an email or a PayPal answer could end up.

## Decision
Option 2.

## Consequences
- The deal set-up spec gains DS-FR-52 and DS-FR-53.
- A failure is seen in the log when it happens, not twelve tries later. The line says whether the job will be tried again or has given up, so the separate line for giving up goes.
- The jobs table's record of a failure is the error's name, code and place. Messages already stored are cleared by the migration.
- The log does not show that a timer ran, only that one broke. Whether a job is waiting or done is read from the jobs table.
- With the message gone from the log and the table, a stuck job says what kind of error it was and where, not what the database or PayPal said. That is the same price paid for requests.
