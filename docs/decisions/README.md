# Decisions

Architecture and product decisions for Cleared, one file per decision.

## Rules

- File name: `YYYY-MM-DD-short-title.md`, dated the day the decision was made.
- Only William or Furqaan make decisions. The agent records them; it never decides.
- **Never edit a record after it is written.** To change a decision, write a new record that supersedes the old one, and name the old one in the new record's "Supersedes" field and mark it superseded in the table below.
- Link each record from the Revision table of every spec it affects in `docs/specs/`.
- If a decision changes `docs/PRODUCT.md`, update that line and point it at the record.

## Format

```md
# <Decision in a few words>

**Date:** YYYY-MM-DD
**Status:** Accepted | Superseded by <file>
**Decided by:** <name>
**Supersedes:** <file> | none

## Context
What prompted the decision, in a few sentences.

## Options
1. **<Option>.** Trade-offs.
2. **<Option>.** Trade-offs.

## Decision
What was chosen, in one or two sentences.

## Consequences
What changes because of this: docs, code, scope, risks.
```

## Records

| Date | Decision | Status |
| --- | --- | --- |
| 2026-10-06 | [Evidence view uses cards, not AG Grid](2026-10-06-evidence-view-cards.md) | Superseded by [2026-10-06-evidence-view-ag-grid.md](2026-10-06-evidence-view-ag-grid.md) |
| 2026-10-06 | [Evidence table and brand dashboard use AG Grid on tablet and up](2026-10-06-evidence-view-ag-grid.md) | Accepted |
| 2026-10-06 | [Visual world is set by a design prototype in design/](2026-10-06-design-prototype-first.md) | Accepted |
| 2026-10-06 | [Frontend stack for web/: Tailwind, Radix, Motion, Vitest and Playwright](2026-10-06-frontend-stack.md) | Accepted |
| 2026-10-06 | [Frontend mocks are served with MSW](2026-10-06-frontend-mocks-msw.md) | Accepted |
| 2026-10-07 | [Mock data is on by default in development](2026-10-07-mock-data-on-by-default-in-dev.md) | Accepted |
| 2026-10-06 | [Repo layout: pnpm workspace with web/, backend/ and contract/](2026-10-06-repo-layout-and-package-manager.md) | Accepted |
| 2026-10-06 | [API responses are validated with Zod](2026-10-06-schema-validation-zod.md) | Accepted |
| 2026-10-06 | [The creator can ask the brand to accept an Unsure item](2026-10-06-creator-asks-brand-to-accept-unsure.md) | Accepted |
| 2026-10-06 | [A deadline is the end of its day in the creator's timezone](2026-10-06-deadline-end-of-day-creator-timezone.md) | Superseded by [2026-10-06-deadline-shared-date-with-local-time.md](2026-10-06-deadline-shared-date-with-local-time.md) |
| 2026-10-06 | [A deadline is one shared date, with the viewer's own time added](2026-10-06-deadline-shared-date-with-local-time.md) | Accepted |
| 2026-10-07 | [Backend is one Hono service on Bun, with Prisma and Postgres, not Lambda](2026-10-07-backend-hono-bun-prisma-postgres.md) | Accepted |
| 2026-10-08 | [The brand asks for changes; the creator makes them](2026-10-08-brand-asks-for-changes-not-edits.md) | Accepted |
| 2026-10-08 | [The brand gets in by its link, swapped for a deal-scoped session](2026-10-08-brand-access-by-link-session.md) | Accepted |
| 2026-10-08 | [Mock data is kept in the browser in a mock build](2026-10-08-mock-data-kept-in-the-browser.md) | Accepted |
| 2026-10-08 | [Cleared takes a 5% fee from the creator's payout; holds are $20 to $10,000](2026-10-08-cleared-fee-and-amount-limits.md) | Accepted |
| 2026-10-08 | [What ends a hold once a post is published](2026-10-08-what-ends-a-hold-after-publishing.md) | Accepted |
| 2026-10-08 | [Before publishing: a 48-hour go-ahead, who can cancel, and posts that are never held](2026-10-08-go-ahead-cancel-and-unheld-posts.md) | Accepted |
| 2026-10-08 | [Timers and retries run from our own jobs table in Postgres](2026-10-08-jobs-table-in-postgres.md) | Accepted |
| 2026-10-08 | [The backend calls PayPal through its server SDK, behind our own interface](2026-10-08-paypal-client-sdk-behind-port.md) | Accepted |
| 2026-10-08 | [Backend tests: Bun's test runner, a real Postgres and a fake PayPal](2026-10-08-backend-test-tooling.md) | Accepted |
| 2026-10-08 | [A go-ahead runs to the deadline when the deadline falls inside PayPal's guarantee](2026-10-08-go-ahead-runs-to-a-deadline-inside-the-guarantee.md) | Accepted |
| 2026-10-08 | [The first capture re-confirms a hold whose guarantee has ended](2026-10-08-first-capture-re-confirms-a-lapsed-hold.md) | Accepted |
| 2026-10-08 | [A payout PayPal will not send is retried and put in front of Cleared](2026-10-08-a-payout-paypal-will-not-send.md) | Accepted |
| 2026-10-08 | [A deliverable's money state is stored as one document](2026-10-08-money-state-as-one-document.md) | Accepted |
| 2026-10-08 | [A brand objection is settled by the creator and the brand](2026-10-08-objection-settled-by-the-two-sides.md) | Accepted; accepted by Furqaan, 9 Oct |
| 2026-10-08 | [The brand gets a fresh link each time a draft needs it](2026-10-08-fresh-brand-link-per-review.md) | Accepted; accepted by Furqaan, 9 Oct |
| 2026-10-08 | [Creators sign in with Google through the backend, which sets an HttpOnly session](2026-10-08-creator-sign-in-through-the-backend.md) | Superseded in part by [2026-10-09-creators-sign-in-with-google-directly.md](2026-10-09-creators-sign-in-with-google-directly.md): no Cognito |
| 2026-10-09 | [Creators sign in with Google directly, with no Cognito](2026-10-09-creators-sign-in-with-google-directly.md) | Accepted |
| 2026-10-09 | [The app and the API share one domain, on two subdomains](2026-10-09-app-and-api-on-one-domain.md) | Accepted |
| 2026-10-09 | [The API contract is an OpenAPI document generated from the backend's Zod schemas](2026-10-09-api-contract-generated-from-zod.md) | Accepted |
| 2026-10-09 | [Briefs are read by Claude Opus 5.5 on Bedrock, in one call, with limits](2026-10-09-briefs-read-by-claude-opus-on-bedrock.md) | Accepted |
| 2026-10-09 | [An invite link is worked out again each time, never stored](2026-10-09-an-invite-link-is-worked-out-again.md) | Accepted |
| 2026-10-09 | [Drafts are uploaded through the API to a private S3 bucket](2026-10-09-drafts-uploaded-through-the-api-to-s3.md) | Accepted |
| 2026-10-09 | [The limits on drafts](2026-10-09-limits-on-drafts.md) | Accepted |
| 2026-10-09 | [Amazon Nova judges what is shown](2026-10-09-amazon-nova-judges-what-is-shown.md) | Accepted |
| 2026-10-09 | [How an AI pass is verified before it counts](2026-10-09-how-an-ai-pass-is-verified.md) | Accepted |
| 2026-10-09 | [A broken check fails the whole run](2026-10-09-a-broken-check-fails-the-run.md) | Accepted |
| 2026-10-09 | [No email yet: the creator sends the review link](2026-10-09-no-email-yet-the-creator-sends-the-review-link.md) | Accepted |
| 2026-10-09 | [The unlisted YouTube video is asked for at publish, not at the draft check](2026-10-09-the-unlisted-video-is-asked-for-at-publish.md) | Accepted |
| 2026-10-09 | [Who can watch a draft, and how long it is kept](2026-10-09-who-can-watch-a-draft-and-how-long-it-is-kept.md) | Accepted |
| 2026-10-09 | [Test clips are recorded by the team](2026-10-09-test-clips-are-recorded-by-the-team.md) | Accepted |
| 2026-10-10 | [The unlisted video is given with the request for the go-ahead](2026-10-10-the-unlisted-video-is-given-with-the-go-ahead.md) | Accepted |
| 2026-10-10 | [Demo accounts read one real YouTube channel the team owns](2026-10-10-demo-accounts-read-a-shared-channel.md) | Accepted |
| 2026-10-10 | [Which live check finding gives which answer](2026-10-10-which-live-check-finding-gives-which-answer.md) | Accepted |
| 2026-10-10 | [Lost YouTube access decides nothing](2026-10-10-lost-youtube-access-decides-nothing.md) | Accepted |
| 2026-10-10 | [A ruling is a command, not a page](2026-10-10-a-ruling-is-a-command-not-a-page.md) | Accepted |
| 2026-10-10 | [A PayPal email change reaches every deliverable where no payout has started](2026-10-10-a-paypal-email-change-reaches-where-no-payout-has-started.md) | Accepted |
| 2026-10-10 | [Email for the brand's two notices after publishing, to an address the brand gives](2026-10-10-email-for-the-brands-two-notices-after-publishing.md) | Superseded in part by [2026-10-10-resend-sends-the-brands-two-notices.md](2026-10-10-resend-sends-the-brands-two-notices.md): Resend, not Amazon SES |
| 2026-10-10 | [Resend sends the brand's two notices, in place of Amazon SES](2026-10-10-resend-sends-the-brands-two-notices.md) | Accepted |
| 2026-10-10 | [A post found public when Cleared asks at the deadline is in time](2026-10-10-a-post-found-public-at-the-deadline-is-in-time.md) | Accepted |
