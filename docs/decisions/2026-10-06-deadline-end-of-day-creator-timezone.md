# A deadline is the end of its day in the creator's timezone

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William (Furqaan can supersede)
**Supersedes:** none

## Context
A deliverable's deadline was stored as an exact moment. A deadline of 24 Oct 23:59 UTC showed as "25 Oct" to a viewer in West Africa Time, which reads like the wrong day. How a deadline is stored and shown is shared product behaviour. William decided so the frontend can be built; Furqaan can supersede it with a new record.

## Options
1. **End of the day in the creator's timezone.** "Post by 24 Oct" means 23:59 on 24 Oct where the creator is. Every deadline date is shown in the creator's timezone, so the creator and the brand see the same day. Countdowns use the exact moment. The backend stores the creator's timezone.
2. **An exact moment, shown with its time and timezone** ("24 Oct, 23:59 WAT"). Simpler for the backend, but more to read, and still easy to misjudge.

## Decision
Option 1.

## Consequences
- The creator draft check FRD's DC-FR-44 can be built.
- The API sends `deadline` as the moment of 23:59 in the creator's timezone and `creatorTimeZone` as an IANA name (for example "Africa/Lagos"); both are in the FRD's Requests for Furqaan.
- The 72-hour deadline warning (DC-FR-11) still counts from the exact moment.
- The deadline cap (21 days after the hold) is unaffected; the backend applies it to the stored moment.
