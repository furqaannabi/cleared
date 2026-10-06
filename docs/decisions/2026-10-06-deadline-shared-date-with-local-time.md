# A deadline is one shared date, with the viewer's own time added

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William (Furqaan can supersede)
**Supersedes:** [2026-10-06-deadline-end-of-day-creator-timezone.md](2026-10-06-deadline-end-of-day-creator-timezone.md)

## Context
The earlier record showed every deadline in the creator's timezone only. William wanted each person to see the deadline in their own time as well. Showing each viewer only their local time would let the creator and the brand read different dates for the same deadline (24 Oct in Lagos is 25 Oct in Tokyo), which invites disputes about money.

## Options
1. **One shared date, plus the viewer's own time when it differs.** The deadline is the end of its day in the creator's timezone, so everyone reads the same date. When the viewer's timezone is different, the page adds when it ends for them ("ends 18:59 your time", or "ends 25 Oct, 07:59 your time" when their date differs).
2. **The creator's timezone only** (the earlier record). Simplest, but a brand elsewhere has to work out the difference.
3. **Each viewer's local time only.** Natural for each person, but the two sides can see different dates.

## Decision
Option 1.

## Consequences
- The creator draft check FRD's DC-FR-44 is rewritten (revision 1.5).
- The API sends `deadline` as the moment of 23:59 in the creator's timezone and `creatorTimeZone` as an IANA name; both are in the FRD's Requests for Furqaan.
- Countdowns, including the 72-hour warning (DC-FR-11), use the exact moment.
- The brand's pages follow the same rule when they are specced.
