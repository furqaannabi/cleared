# The brand gets a fresh link each time a draft needs it

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** William (Furqaan to review; Furqaan can supersede)
**Supersedes:** none

## Context
The brand gets in by the invite link, swapped for a deal-scoped session ([decision](2026-10-08-brand-access-by-link-session.md)). The invite link expires after 7 days (IN-FR-17), but a deliverable's deadline can be up to 21 days after its hold, so the review window can open long after the link stopped working and the session may be gone. The brand also needs to be told that a draft needs it.

## Options
1. **A fresh link per review moment.** When a review window starts or the creator asks the brand about an item, the backend makes a new link for that deal (unguessable, scoped to the deal, expiring, swapped for a session like the invite link) that opens that deliverable's review page. Cleared emails it when a brand email is set, and the creator's draft check page offers "Copy link for {brand}" so the creator can send it.
2. **The invite link stays on until the deal ends.** Simpler, but a forwarded link stays powerful for weeks and now also approves drafts. Weakens the invite-link rule.
3. **The session lasts the whole deal.** Nothing tells the brand a draft is ready, and clearing cookies locks them out.

## Decision
Option 1. A review link follows the invite link's rules and goes through the same token-for-session swap.

## Consequences
- The brand review FRD (RW) adds the review link and its landing; the creator draft check FRD (DC 1.14) adds "Copy link for {brand}".
- The backend makes review links, emails them (SES, as IN-FR-13), and returns where the link lands (RW Requests for Furqaan).
- Risk accepted, as for the invite link: a forwarded review link lets its holder approve or object until it expires. A review link expires once the brand has nothing left to do on that draft (approved, a new draft, or released) or after 7 days, whichever is first; the creator chooses who gets it.
