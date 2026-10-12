# How long Cleared keeps things

**Date:** 2026-10-12
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none. It keeps the 30 days of [2026-10-09-who-can-watch-a-draft-and-how-long-it-is-kept.md](2026-10-09-who-can-watch-a-draft-and-how-long-it-is-kept.md) and gives it the job it lacked

## Context
The privacy page must say how long each kind of data is kept, and it may promise only what the backend does. Only drafts had a period, 30 days after a post ends, and nothing enforced it: no job deletes them, and only the bucket's 90-day rule stood behind it.

## Options
1. **30 days for video, the rest with the account.** Drafts and what was read from them go 30 days after the post ends. The brief, checklist and check results stay while the account exists. Payment records stay for as long as Cleared runs, anonymous once the account is deleted. Logs 30 days.
2. **Shorter: 7 days for video, logs 14 days.** Less held, but a brand or creator who comes back about a paid post after a week finds no video.
3. **A fixed end for payment records too,** 7 years. The usual period for financial records, but a real promise for a sandbox product, with a job nothing would exercise before submission.

## Decision
Option 1.

## Consequences
- A daily job deletes a post's drafts, with the speech, on-screen text and frames read from them, 30 days after the post is paid, released, closed, or approved and not paid. The check's results stay with the deal.
- A live Reel's fetched video is kept only until its match is decided.
- The brief, checklist, notes, check results and evidence, and the brand's email are kept while the creator's account exists, and go when it is deleted.
- Payment records have no end date. Once the account is deleted they carry no name or email.
- A deleted account's records go at once and its files within 24 hours.
- Server logs carry ids only and are kept 30 days. That is set on the server by Furqaan with log rotation, not by code, and must be in place before the legal pages are linked.
- Every stated period names what enforces it. One with nothing behind it is not stated.
