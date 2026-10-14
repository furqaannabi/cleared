# The stored names cleared_ruled, cleared_to_rule and with_cleared stay

**Date:** 2026-10-14
**Status:** Accepted
**Decided by:** William
**Supersedes:** none. It settles the open item in [2026-10-14-the-product-is-named-sponing.md](2026-10-14-the-product-is-named-sponing.md)

## Context
After the rename to Sponing, three internal names still carry the old product name. Each belongs to the case where a person at Sponing rules on a live post the brand objected to (MP-FR-19, PT-FR-35):
- `cleared_to_rule`: the deliverable's money state is waiting for that person;
- `cleared_ruled`: the money event recorded when they rule, also stored as the release reason;
- `with_cleared`: the state the API sends the frontend ("A person at Sponing is deciding").

The first two are stored in money records that already exist.

## Options
1. **Leave them.** No user sees them; the pages already say Sponing. Nothing to migrate.
2. **Rename them.** A migration rewrites the stored money events and states, and the contract changes for `with_cleared`. This touches money-state code for names only developers read.

## Decision
Option 1. The three names stay as they are.

## Consequences
- In code, "cleared" in these names means the company, as it did before the rename.
- No migration, and no contract change.
