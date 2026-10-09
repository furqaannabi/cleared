# The API contract is an OpenAPI document generated from the backend's Zod schemas

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none

## Context
Furqaan chose OpenAPI as the contract's format when the backend moved to Hono. How the document is produced was left open, and the contract as a whole is a decision for both leads. William's client validates every response with Zod schemas he wrote by hand from provisional shapes, because no contract existed. The first routes are about to be built.

## Options
1. **Generated from the backend's Zod schemas.** Each route declares what it accepts and returns as Zod schemas, with Hono's OpenAPI add-on. The same schemas check requests at run time and produce the document, which is written to `contract/` with TypeScript types for `web/`. The document cannot drift from what the backend does.
2. **Written by hand first.** A file both leads edit and agree, with types generated for both sides. Settled before any route is built, but the file and the code can disagree.
3. **Shared Zod schemas, OpenAPI later.** Both sides import the same schemas from `contract/`. Least machinery, but it sets the chosen format aside until the end.

## Decision
Option 1.

## Consequences
- The backend gains one dependency, `@hono/zod-openapi`. It replaces writing an OpenAPI file by hand and writing request checks twice.
- `contract/` holds the generated document and the types generated from it, and no hand-written logic, as the repo layout record says.
- A test fails when the document in the repo does not match the code, so a change to a route cannot land without its contract.
- William's hand-written schemas are replaced by the generated types a page at a time. Until a route exists, its provisional shape stays his.
- Where a provisional shape and the built route differ, the route's schema wins and the difference is listed for William in the spec that built it.
- CLAUDE.md's "Not yet decided" row for the API contract is closed, waiting only on William's agreement.
