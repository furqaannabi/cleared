# Timers and retries run from our own jobs table in Postgres

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
The [backend decision](2026-10-07-backend-hono-bun-prisma-postgres.md) put timers and the pipeline in a job queue kept in Postgres and left the library unchosen. The money path is the first thing that needs it: the deadline, day 28, the go-ahead's end, the 48-hour windows, capture retries and the checker are all jobs.

## Options
1. **Our own jobs table.** One Prisma model and a small worker loop that claims due rows under a row lock. A job is written in the same transaction as the money change it belongs to. No new dependency, nothing that might misbehave on Bun. We write and test retry, back-off and failed-job handling ourselves.
2. **pg-boss.** Mature, with delayed jobs, retries and scheduling built in. It keeps its own tables outside the Prisma schema, writing a job inside a Prisma transaction takes an adapter, and it is untested by us on Bun.
3. **Graphile Worker.** Mature and fast, with the same trade-offs as pg-boss and the least certain Bun support.

## Decision
Option 1: our own jobs table, in the Prisma schema, with a worker loop in the backend service.

## Consequences
- A money change and its follow-up job commit together or not at all, which the money path spec relies on (MP-FR-42, MP-BR-07).
- The runner is general, with handlers registered by name; the draft check pipeline will use it too.
- We own the behaviour the libraries would have given: growing delays between tries, a limit after which a job is marked failed and logged, and due jobs running after a restart (MP-FR-43). These are tested against a real Postgres.
- If the pipeline later needs more than this (priorities, rate limits, fan-out), a library can replace the runner behind the same handler interface, with a new record.
- `CLAUDE.md`'s "Not yet decided" row for the job queue library is closed.
