# The product is named Sponing

**Date:** 2026-10-14
**Status:** Accepted
**Decided by:** William and Furqaan (as told by William, 14 October)
**Supersedes:** none. It replaces the name chosen in `docs/PRODUCT.md` ("The name"); earlier records keep the name Cleared as written

## Context
The product was called Cleared. The team has changed the name to Sponing, and the API now runs at `backend.sponing.com`. "Cleared" is also a product word: the status of a deliverable that has passed its live check and been paid, and the verb in the tagline "Brand deals where the content and the payment clear together."

## Options
1. **Rename the product, keep the word.** Everything that names the product says Sponing; "cleared" stays the paid status and the tagline stays.
2. **Rename both.** The status and the tagline get new words too; that needs its own grill-me.
3. **Rename only what users see.** Docs and internal names keep Cleared for now.

## Decision
Option 1, across the frontend, the backend and the live docs.

- **Name:** Sponing, written with a capital S.
- **Addresses:** the app is at `sponing.com`, the API at `backend.sponing.com`.
- **Kept:** "Cleared" as the paid status (the glossary term, "Cleared. Nothing more to do on this post.", the Cleared seal) and the tagline.
- **Internal names renamed:** the session cookies (`sponing_session`, `sponing_brand_{deal}`, `sponing_pending`, `sponing_pending_instagram`), the test hosts (`*.sponing.test`, `sponing.example`), the payments CSV (`sponing-payments-{date}.csv`), the rail's saved setting (`sponing.rail-folded`), and the root package name (`sponing`).
- **Not renamed:**
  - dated decision records, which are never edited;
  - the specs' Revision rows, which record what happened;
  - the `design/` prototypes;
  - the GitHub repository and the local folder;
  - the real AWS resources and the local database, whose names are set where they are deployed;
  - the identifiers that use "cleared" as the product word (`draft_cleared` and the like).
- **Still open:** the stored money events and API values that name the company (`cleared_ruled`, `cleared_to_rule`, `with_cleared`) are left as they are, because renaming them needs a data migration of recorded money events and a contract change. William and Furqaan decide whether to rename them.

## Consequences
- Every creator and brand is signed out once when the backend with the new cookie names is deployed. The creator's folded rail opens again once.
- **On deploy:**
  - William sets `NEXT_PUBLIC_API_BASE_URL=https://backend.sponing.com` on Vercel.
  - Furqaan sets the backend's app address to `https://sponing.com` and `EMAIL_FROM` to a Sponing sender.
  - Furqaan updates the redirect addresses registered with Google, Instagram and PayPal, or sign-in and connecting break.
- Brand emails, page titles, the logo, the legal pages and the brief reader's prompt say Sponing.
- Each spec carries one Revision row pointing here: wording only, no behaviour changes.
