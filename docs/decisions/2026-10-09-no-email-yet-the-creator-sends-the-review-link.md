# No email yet: the creator sends the review link

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none

## Context
Silence clears a fully passing draft after 48 hours, so the brand has to learn a draft is waiting. Nothing in Cleared sends email: deal set-up left it out. William's brand review spec assumes an email through Amazon SES when a window opens. SES starts in a mode that only delivers to verified addresses, and leaving it needs a request to AWS.

## Options
1. **The creator sends the link; no email yet.** The creator's page shows the brand's link and says the 48 hours have started. The backend records when the brand first opens the draft. Email becomes its own spec later.
2. **Add SES email in this spec.** Fairer to the brand and what William's spec expects, but it adds a service, a verified sender and the production-access request, and for the demo only verified addresses would receive anything.
3. **Start the window when the brand first opens the draft.** Fairest to the brand, but a brand that never opens the link blocks the creator, and it changes the locked rule "48 hours from a fully passing draft".

## Decision
Option 1.

## Consequences
- The review window still starts when a draft becomes fully passing, as the product rule says.
- The creator's post carries the review link while the brand has something to do, and when the brand first opened the draft.
- No route sends email, and `emailedTo` is never returned. William's pages must not say an email was sent.
- Risk accepted: a brand that is never sent the link is cleared by silence. The creator, who wants to be paid, has every reason to send it.
- Email through SES is a later spec of its own.
