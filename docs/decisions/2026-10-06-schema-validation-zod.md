# API responses are validated with Zod

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
`CLAUDE.md` requires every request body and every API response to be validated with a schema. The creator draft check FRD left the library open until the API client was built. The client handles money and status data (hold amounts, item results), which must never be misread.

## Options
1. **Zod.** The most widely used option, with the best docs and examples. A backend in TypeScript could share the same schemas, and tools can produce or read an OpenAPI file from them. Cost: a larger client bundle, roughly 10–15 KB gzipped for a full app's schemas with Zod 4.
2. **Valibot.** Same idea with a function-style API and a far smaller bundle (often under 2 KB, since only what is used is included). Fewer examples and tools, and less familiar.
3. **No library.** Hand-written checks. Nothing in the bundle, but verbose, easy to get wrong, and no TypeScript types for free.

## Decision
Option 1, Zod.

## Consequences
- The typed API client in `web/src/lib/api/` parses every response with a Zod schema. A response that fails parsing is an error and is never partly shown.
- TypeScript types for API data come from the schemas, replacing the hand-written provisional types as each endpoint is built.
- Schemas stay provisional in `web/` until the API contract is agreed, then move to `contract/`.
- `CLAUDE.md` Tech Stack and the creator draft check FRD (revision 1.2) record the choice.
