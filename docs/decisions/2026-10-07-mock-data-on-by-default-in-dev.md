# Mock data is on by default in development

**Date:** 2026-10-07
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
The frontend runs on MSW mocks ([Frontend mocks are served with MSW](2026-10-06-frontend-mocks-msw.md)), and there is no backend yet. Mocks only started when `NEXT_PUBLIC_API_MOCKING=enabled` was set, so a plain `pnpm dev` called an API that doesn't exist: every page after the landing page showed "We couldn't find this deal" or a blank screen, and the app looked broken.

## Options
1. **Default the flag in the `dev` script.** `pnpm dev` uses mock data unless `NEXT_PUBLIC_API_MOCKING=disabled` is set. No file to commit; `.env` files stay gitignored.
2. **Commit `web/.env.development` with the flag.** Same effect, but needs a gitignore exception for env files, which invites a secret being committed there later.
3. **Keep it opt-in** and document the flag. Nothing changes; the trap stays.

## Decision
Option 1.

## Consequences
- `pnpm dev` (from the repo root or `web/`) runs on mock data. To try a real backend: `NEXT_PUBLIC_API_MOCKING=disabled pnpm dev`.
- Production builds never mock, whatever the flag says (`shouldEnableMocking` requires development).
- Revisit when the backend can run locally: the default may flip to the real API.
