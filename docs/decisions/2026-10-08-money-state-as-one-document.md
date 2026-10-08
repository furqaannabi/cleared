# A deliverable's money state is stored as one document

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
The money path's rules are a pure function: given a deliverable's money state and an event, it returns the next state. That state already holds everything about the deliverable's money, including its hold attempt, capture and payout. The signed spec listed separate tables for hold attempts and payouts. When the module that ties the rules to Postgres came to be built, storing the state as tables meant writing and testing code to map every field both ways, and changing a migration with every new rule.

## Options
1. **One state document per deliverable.** The state is saved whole, as one JSON column on the deliverable's money row, beside typed columns for what is searched (the stage and the amount) and a version number. PayPal calls, the money record, PayPal events and jobs stay as tables. No mapping code, so the rules and the database cannot drift apart, and locking a deliverable is locking one row. Hold attempts and payouts cannot be queried with plain SQL.
2. **Separate tables, as the spec listed.** Everything is typed and queryable in SQL. A few hundred lines of mapping that must mirror every field, a migration for each new rule, and more to test.
3. **Events only, state rebuilt by replay.** The record is complete by construction. Changing a setting later, such as the fee, would change what old events replay to, which is dangerous for money without snapshots.

## Decision
Option 1.

## Consequences
- The money path FRD's Schema paragraph is rewritten (revision 1.4). No requirement changes.
- Dates inside the document are written in a marked form and turned back into dates when it is read, so a state survives the round trip exactly. A test proves it.
- The document is read and written only by the money module. Nothing else may edit it.
- A webhook finds its deliverable through the PayPal calls table, which keeps each call's PayPal reference in an indexed column.
- A question such as "every deliverable with an unclaimed payout" needs a JSON query or a new typed column. The stage has a typed column because the pages and jobs search by it.
- Changing the shape of the state later means migrating stored documents, not columns. The version number on the row is there for that.
