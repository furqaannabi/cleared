# Specs

One FRD per surface. Each lists numbered functional requirements (`<PREFIX>-FR-NN`) and business rules (`<PREFIX>-BR-NN`), and ends with a Revision table linking the decisions in `docs/decisions/` that shaped it. Specs carry no dates.

A spec is signed only when William or Furqaan says so after reading it. No code is written against an unsigned spec.

## Status

| Spec | Prefix | Surface | Owner | Status |
| --- | --- | --- | --- | --- |
| [Creator draft check](creator-draft-check-frd.md) | DC | Creator app: one deliverable at the draft check | William | Signed by William (1.13) |
| [Landing page](landing-frd.md) | LP | Landing at `/`, and the `/deals` entry into the creator app | William | Signed by William (1.1) |
| [Creator brief → checklist](creator-brief-checklist-frd.md) | BC | Creator app: a new deal, its brief, and a checklist per post | William | Signed by William (1.3) |
| [Creator invite](creator-invite-frd.md) | IN | Creator app: amounts, deadlines, accounts, PayPal email and the brand link | William | Signed by William (1.2) |
| [Confirm and hold](confirm-and-hold-frd.md) | CH | The brand's deal page from the invite link (terms, checklist, changes, agree, one hold per post) and the creator's side of it | William | Signed by William (1.1) |
| [Money path](money-path-frd.md) | MP | Backend: one deliverable's money, from the hold to cleared or released (hold, go-ahead, capture, payout, release, PayPal webhooks) | Furqaan | Signed by Furqaan (1.0) |
