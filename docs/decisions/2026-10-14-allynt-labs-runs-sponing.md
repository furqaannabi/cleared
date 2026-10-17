# Allynt Labs runs Sponing, and the legal pages drop "hackathon"

**Date:** 2026-10-14
**Status:** Accepted (Furqaan); William to agree
**Decided by:** Furqaan
**Supersedes:** none

## Context
The legal pages say they were "Written for the Sponing hackathon project", and the terms call Sponing "a hackathon project on PayPal's sandbox". They name no one behind Sponing, and their contact is a personal address. Meta asks that an app's privacy policy be the app's own, that it say how to ask for data to be deleted, and that the contact it gives be "up to date and valid". Its FAQ adds that saying deletion can be requested is not enough without saying how.

## Options
1. **Name Allynt Labs, drop "hackathon" from the legal pages, and give a Sponing contact.** The pages say who runs Sponing and read as a product's own policy. The landing footer still says the project is built for the hackathon.
2. **Drop "hackathon" everywhere, the landing footer included.** Consistent, but the footer is where judges see the project's context and the sponsor tools used.
3. **Leave the pages as they are.** No work, but the policy names no one and its deletion steps are only on another page.

## Decision
Option 1.

- **Entity:** the pages name "Allynt Labs", with no company form or jurisdiction.
- **Line under each title:** "Sponing is run by Allynt Labs." The "Not reviewed by a lawyer" note goes.
- **Terms:** "Sponing is run by Allynt Labs. It runs on PayPal's sandbox: no real money moves." The sandbox fact stays.
- **Contact:** `hi@sponing.com`, on the legal pages and on the crash page, which shares the same address.
- **Privacy policy:** says how to delete an account in its own words (Settings, or by email within 30 days), not only by pointing to the deletion page.
- **Landing footer:** unchanged; it still says "Built for the PayPal AI Hackathon".

## Consequences
- Legal pages FRD revision 1.3 (LG-FR-01, LG-FR-04, LG-FR-09, LG-FR-11) and error pages FRD revision 1.2 (EP-FR-03), each awaiting William's signature before the build.
- **Risk:** `sponing.com` has no MX record on 14 October, so mail to `hi@sponing.com` is lost. The address must receive mail before the pages show it; until then the deletion steps point to an address nobody reads, which fails Meta's "up to date and valid".
- The Meta app's owner in the App Dashboard should match Allynt Labs, so the policy is plainly the app's own.
- `docs/PRODUCT.md` still says Sponing is being built for the hackathon; that is accurate and unchanged.
