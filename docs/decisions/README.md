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
| 2026-10-06 | [Frontend mocks are served with MSW](2026-10-06-frontend-mocks-msw.md) | Superseded in part by [2026-10-11-frontend-on-the-live-api.md](2026-10-11-frontend-on-the-live-api.md): MSW stays for per-test stubs only |
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
| 2026-10-08 | [Creators sign in with Google through the backend, which sets an HttpOnly session](2026-10-08-creator-sign-in-through-the-backend.md) | Superseded in part by [2026-10-09-creators-sign-in-with-google-directly.md](2026-10-09-creators-sign-in-with-google-directly.md): no Cognito; and by [2026-10-11-no-demo-accounts.md](2026-10-11-no-demo-accounts.md): no demo account |
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
| 2026-10-10 | [Demo accounts read one real YouTube channel the team owns](2026-10-10-demo-accounts-read-a-shared-channel.md) | Superseded by [2026-10-11-no-demo-accounts.md](2026-10-11-no-demo-accounts.md) |
| 2026-10-10 | [Which live check finding gives which answer](2026-10-10-which-live-check-finding-gives-which-answer.md) | Accepted |
| 2026-10-10 | [Lost YouTube access decides nothing](2026-10-10-lost-youtube-access-decides-nothing.md) | Accepted |
| 2026-10-10 | [A ruling is a command, not a page](2026-10-10-a-ruling-is-a-command-not-a-page.md) | Accepted |
| 2026-10-10 | [A PayPal email change reaches every deliverable where no payout has started](2026-10-10-a-paypal-email-change-reaches-where-no-payout-has-started.md) | Accepted |
| 2026-10-10 | [Email for the brand's two notices after publishing, to an address the brand gives](2026-10-10-email-for-the-brands-two-notices-after-publishing.md) | Superseded in part by [2026-10-10-resend-sends-the-brands-two-notices.md](2026-10-10-resend-sends-the-brands-two-notices.md): Resend, not Amazon SES |
| 2026-10-10 | [Resend sends the brand's two notices, in place of Amazon SES](2026-10-10-resend-sends-the-brands-two-notices.md) | Accepted |
| 2026-10-10 | [A post found public when Cleared asks at the deadline is in time](2026-10-10-a-post-found-public-at-the-deadline-is-in-time.md) | Accepted |
| 2026-10-11 | [Instagram Reels: the whole path in one spec, with Meta's access proven first](2026-10-11-instagram-reels-whole-path-access-proven-first.md) | Accepted |
| 2026-10-11 | [A creator connects Instagram with Instagram Login and one read-only permission](2026-10-11-instagram-login-read-only.md) | Accepted |
| 2026-10-11 | [A Reel's go-ahead checks the account can be read, then the hold](2026-10-11-a-reels-go-ahead-checks-the-account-then-the-hold.md) | Accepted |
| 2026-10-11 | [A live Reel is matched to the approved draft by its length, then its words](2026-10-11-a-live-reel-is-matched-by-length-then-words.md) | Accepted |
| 2026-10-11 | [A Reel nobody gave a link for is not looked for](2026-10-11-a-reel-nobody-gave-a-link-for-is-not-looked-for.md) | Accepted |
| 2026-10-11 | [Demo accounts read one real Instagram account the team owns](2026-10-11-demo-accounts-read-a-shared-instagram-account.md) | Superseded by [2026-10-11-no-demo-accounts.md](2026-10-11-no-demo-accounts.md) |
| 2026-10-11 | [No Meta review of the app for the hackathon](2026-10-11-no-meta-review-for-the-hackathon.md) | Accepted |
| 2026-10-11 | [No demo accounts: every creator signs in with Google](2026-10-11-no-demo-accounts.md) | Accepted; agreed by William, 11 Oct |
| 2026-10-11 | [The frontend runs on the live API; tests stub their own requests](2026-10-11-frontend-on-the-live-api.md) | Accepted; superseded in part by [2026-10-11-mocks-go-in-one-last-slice.md](2026-10-11-mocks-go-in-one-last-slice.md): when the mocks go; and by [2026-10-12-playwright-live-suite-local-backend-up-to-agreeing.md](2026-10-12-playwright-live-suite-local-backend-up-to-agreeing.md): where Playwright runs and what it covers |
| 2026-10-11 | [The shared mocks are removed in one last slice](2026-10-11-mocks-go-in-one-last-slice.md) | Accepted; superseded in part by [2026-10-12-vitest-leaves-the-shared-mocks-before-playwright.md](2026-10-12-vitest-leaves-the-shared-mocks-before-playwright.md): the slice is split in two |
| 2026-10-12 | [The creator's payment history uses AG Grid, and its charts AG Charts](2026-10-12-ag-grid-and-ag-charts-on-creator-home.md) | Accepted |
| 2026-10-12 | [Vitest leaves the shared mocks before Playwright does](2026-10-12-vitest-leaves-the-shared-mocks-before-playwright.md) | Accepted; superseded in part by [2026-10-12-playwright-live-suite-local-backend-up-to-agreeing.md](2026-10-12-playwright-live-suite-local-backend-up-to-agreeing.md): where Playwright runs once the mocks go |
| 2026-10-12 | [A live Reel's video is read at most three times](2026-10-12-a-reels-reading-is-tried-three-times.md) | Accepted |
| 2026-10-12 | [Deleting an account removes what the creator made and keeps anonymous money records](2026-10-12-deleting-an-account-keeps-the-money-records.md) | Accepted |
| 2026-10-12 | [Disconnecting deletes Cleared's access, then asks Google to revoke it](2026-10-12-disconnecting-deletes-then-revokes-at-google.md) | Accepted |
| 2026-10-12 | [How long Cleared keeps things](2026-10-12-how-long-cleared-keeps-things.md) | Accepted |
| 2026-10-12 | [End-to-end tests get a session behind a secret, as one fixed test creator](2026-10-12-a-test-session-behind-a-secret.md) | Accepted |
| 2026-10-12 | [Playwright runs live against a local backend, up to the brand agreeing](2026-10-12-playwright-live-suite-local-backend-up-to-agreeing.md) | Accepted; superseded in part by [2026-10-12-playwright-live-suite-stops-at-the-invite.md](2026-10-12-playwright-live-suite-stops-at-the-invite.md): how far the deal goes |
| 2026-10-12 | [The live Playwright suite stops at the invite until the test creator can have an account](2026-10-12-playwright-live-suite-stops-at-the-invite.md) | Accepted |
| 2026-10-12 | [Judges test Cleared as users do](2026-10-12-judges-test-cleared-as-users.md) | Accepted (William); Furqaan to agree |
| 2026-10-13 | [The brand holds with a PayPal account or a card, and nothing else](2026-10-13-brand-holds-with-paypal-or-card.md) | Accepted (William); Furqaan to agree |
