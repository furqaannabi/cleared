# Specs

One FRD per surface. Each lists numbered functional requirements (`<PREFIX>-FR-NN`) and business rules (`<PREFIX>-BR-NN`), and ends with a Revision table linking the decisions in `docs/decisions/` that shaped it. Specs carry no dates.

A spec is signed only when William or Furqaan says so after reading it. No code is written against an unsigned spec.

## Status

| Spec | Prefix | Surface | Owner | Status |
| --- | --- | --- | --- | --- |
| [Creator draft check](creator-draft-check-frd.md) | DC | Creator app: one deliverable at the draft check | William | Signed by William (1.17) |
| [Landing page](landing-frd.md) | LP | Landing at `/`, and the `/deals` entry into the creator app | William | Signed by William (1.2) |
| [Creator brief → checklist](creator-brief-checklist-frd.md) | BC | Creator app: a new deal, its brief, and a checklist per post | William | Signed by William (1.3) |
| [Creator invite](creator-invite-frd.md) | IN | Creator app: amounts, deadlines, accounts, PayPal email and the brand link | William | Signed by William (1.2) |
| [Confirm and hold](confirm-and-hold-frd.md) | CH | The brand's deal page from the invite link (terms, checklist, changes, agree, one hold per post) and the creator's side of it | William | Signed by William (1.2) |
| [Money path](money-path-frd.md) | MP | Backend: one deliverable's money, from the hold to cleared or released (hold, go-ahead, capture, payout, release, PayPal webhooks) | Furqaan | Signed by Furqaan (1.4) |
| [Brand review](brand-review-frd.md) | RW | The brand's review of each post's draft (answering asks, the 48-hour review window, approve or object) and the creator's side of it | William | Signed by William (1.1) |
| [Publish and pay](publish-and-pay-frd.md) | PP | Both sides of steps 6 to 8: the go-ahead, posting, the live check, capture and payout, the brand's decisions after publishing | William | Signed by William (1.2) |
| [Cancel](cancel-frd.md) | CN | Both sides, from the invite until the go-ahead: cancelling a post or the deal, the note to the other side, and the cancelled and closed states | William | Signed by William (1.1) |
| [Sign-in and welcome](sign-in-frd.md) | SI | Creator app: Sign in with Google, Try the demo account, the welcome page, the sign-in page, the account menu | William | Signed by William (1.0) |
| [Deal set-up](deal-setup-frd.md) | DS | Backend: steps 1 to 3 as an API (sign-in, deals, brief to checklist, the invite and the brand's link, change requests, agreeing, and the hold routes) | Furqaan | Signed by Furqaan (1.1) |
| [Draft check and review](draft-check-and-review-frd.md) | DR | Backend: steps 4 and 5 as an API (sending a draft, the check and its evidence, asking the brand, the 48-hour review window, objections and approval) | Furqaan | Signed by Furqaan (1.1) |
| [Publish to paid](publish-to-paid-frd.md) | PT | Backend: steps 6 to 8 and cancelling as an API (the go-ahead, posting, the live check against YouTube, the brand's decisions after publishing, capture and payout as both sides see them, the two emails, rulings, cancel) | Furqaan | Signed by Furqaan (1.0) |
