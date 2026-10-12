# Creator home: FRD

**Status:** Signed by William (revision 1.2). The payments route is a request for Furqaan; the money sections stay behind a flag until it is in `contract/`.

**Surface:** The creator's home, in two pages (1.2). The overview at `/deals`: the money overview, the performance figures and the deals with what needs the creator first; signing in and the landing page's button land here. Payments at `/payments`: what was paid each month and the payment history with its CSV. The brand has no home.

**Scope of this build:** frontend only, on the live API ([frontend on the live API](../decisions/2026-10-11-frontend-on-the-live-api.md)). The deals list uses `GET /deals`, which the contract has. Everything about money (overview, figures, charts, history, CSV) reads one requested route, `GET /me/payments`; it is built and tested on per-test stubs against the shape asked of Furqaan below, and stays hidden behind a build flag until that route is in `contract/` (HM-FR-20). Nothing here moves money or decides a money state.

## Problem Statement

A creator who signs in is sent straight into their first deal. There is no place that says how much money is held for them, what is on its way, what has been paid, or which post is waiting on them. Payment history lives one post at a time, so a creator can't see what they earned this month, find a PayPal reference for their accounts, or show a brand their record.

## Solution

One home page that answers "where's my money?" first: three totals in what the creator receives, a line for anything stuck, "Paid each month", and three plain counts of how well they run deals. Below, their deals with the ones waiting on them first, and a payment history of every paid post with its PayPal references, downloadable as a CSV.

## User Stories

1. As a creator, I want to land on one page after signing in, so that I see everything before choosing a deal.
2. As a creator, I want to see how much is held for me, so that I know what money is reserved and coming.
3. As a creator, I want to see how much is on its way, so that I know what has been taken from the brand but hasn't reached me yet.
4. As a creator, I want to see how much I've been paid, so that I know what I've earned through Cleared.
5. As a creator, I want every total to be what I actually receive, so that I don't count Cleared's fee as mine.
6. As a creator with a payout that failed or wasn't claimed, I want to be told on home and taken to that post, so that I can fix it before the money is stuck.
7. As a creator, I want to see what I was paid each month, so that I can tell whether I'm earning more.
8. As a creator, I want to see how many of my posts went live on time, so that I can show brands I'm reliable.
9. As a creator, I want to see how many drafts passed the check first time, so that I know how well I follow briefs.
10. As a creator, I want to see how long payment takes after I post, so that I can plan around it.
11. As a creator with only a few deals, I want the figures to say exactly what they count, so that one deal never reads as "100%".
12. As a creator, I want the deals waiting on me listed first, so that I act on the one blocking a payment.
13. As a creator, I want each deal row to say what state each post is in, so that I don't have to open them all.
14. As a new creator with no deals, I want to be told so and offered "Start a deal", so that home isn't a page of zeros.
15. As a creator, I want a history of every paid post with its PayPal references, so that I can match payments in PayPal and in my accounts.
16. As a creator on a laptop, I want to sort and filter the history, so that I can find one brand's payments.
17. As a creator on a phone, I want the history as cards I can read with my thumb, so that I never scroll sideways.
18. As a creator, I want to download my payment history as a CSV, so that I can give it to my accountant or a spreadsheet.
19. As a creator, I want the CSV to open safely in a spreadsheet, so that a brand's name can't run anything.
20. As a creator using a screen reader, I want every chart readable as text, so that I get the same figures.

## Requirements

### The page

| ID | Requirement |
| --- | --- |
| HM-FR-01 | **Where it lives.** `/deals`, in the creator frame, signed-in only (SI-FR-06). It no longer opens the first deal (LP-FR-15, 1.4). (1.2) Page title "Overview". "Overview" is the first link in the rail and the phone's Deals sheet (DC-FR-31, 1.21), marked current here. |
| HM-FR-02 | **Order.** (1.2) The money overview; the performance figures ("How you're doing"); the deals. "Paid each month" and the payment history are on Payments (HM-FR-23). With the flag off (HM-FR-20) only the deals show. |
| HM-FR-03 | **No deals yet.** With no deals, the page says "You have no deals yet." with a "Start a deal" link to `/deals/new`, and nothing else: no totals, figures, charts or history. |
| HM-FR-04 | **Loading and failing.** While a section loads it shows the app's loading state for that section. If the deals fail, the page says "We couldn't load your deals." with Try again (as LP-FR-15 did). If the payments fail, the money sections are replaced by one line "We couldn't load your payments." with Try again; the deals still show. |

### The money overview

| ID | Requirement |
| --- | --- |
| HM-FR-05 | **Three totals, in what the creator receives.** "Held for you" (posts whose hold is in place and not yet captured), "On its way" (captured, payout not yet paid: sending, delayed, unclaimed or failed) and "Paid" (payout paid). Each is the sum of the posts' `received` amounts from the API, after Cleared's fee; the page never works out a fee itself. Each total says how many posts it counts ("3 posts"). A total of zero shows "$0.00", never hidden, once the creator has any deal. (1.1) Under the totals: "What you receive, after Cleared's 5% fee." |
| HM-FR-06 | **What's stuck.** When any post on its way has a payout that failed or wasn't claimed, a line under "On its way" names each: "{brand} · {post}: the payout didn't go through." or "{brand} · {post}: PayPal is waiting for you to accept it.", each linking to the post, where its fix lives (PP). Past three, "and {n} more". |
| HM-FR-25 | **See payments.** (1.2) Under the "Paid" total, a link "See payments" to `/payments`. "Held for you" and "On its way" have no link; the stuck lines keep linking to their posts (HM-FR-06). |
| HM-FR-07 | **Amounts.** Dollars with cents ("$1,140.00"), from integer minor units; totals added in minor units, never floats. |

### Performance

| ID | Requirement |
| --- | --- |
| HM-FR-08 | **On time.** (1.1) "On time", then "{n} of {m} posts", then "went live before their deadline": of posts that went live, how many before their deadline (the deadline as DC-FR-44 reads it). |
| HM-FR-09 | **Passed first time.** (1.1) "Passed first time", then "{n} of {m} drafts", then "passed every item on the first check": of posts whose first draft check finished, how many passed every item on it. |
| HM-FR-10 | **Time to paid.** (1.1) "Time to paid", then "{d}", then "on average, from posting to paid": the mean from published to paid over paid posts, in hours under two days ("20 hours") and days from two ("2 days"), rounded to the nearest. |
| HM-FR-11 | **Counts, not percentages.** Each figure shows once it has at least one post to count; with none it is left out, never "0 of 0". No percentages anywhere. |

### Charts

| ID | Requirement |
| --- | --- |
| HM-FR-12 | **Paid each month.** (1.2) On Payments, full width, above the history. A bar chart of the last six months, each bar what the creator received that month (by the payout's paid date in the creator's time zone), the current month labelled "so far". Months with nothing show an empty bar. Shown once any post has been paid. (1.1) Titled "Paid each month", with "What you received" beside the title. |
| HM-FR-13 | **Trend lines.** Each performance figure gets a small line of its value by month, shown only once there are three or more months with posts to count for it. |
| HM-FR-14 | **Readable as text.** Every chart has a text equivalent screen readers get ("October so far: $2,280.00", "On time by month: August 2 of 2, …"), and nothing in a chart is only in colour or only on hover. Charts are drawn with AG Charts Community, loaded only when they scroll into view ([AG Grid and AG Charts on creator home](../decisions/2026-10-12-ag-grid-and-ag-charts-on-creator-home.md)). |

### The deals

| ID | Requirement |
| --- | --- |
| HM-FR-15 | **Needs you first.** Deals with a post waiting on the creator come first under "Needs you", the rest under "Under way" and then "Finished" (every post paid, released or closed). Waiting on the creator: the deal at the checklist, invite or changes-requested step, or a post with no draft, a failed check, results to act on, an objection, or an approved draft without a go-ahead; or a payout that failed or wasn't claimed. Newest first within each. Each row: brand, each post's platform and state in the rail's words, linking where the rail's row links (DC-FR-37). |

### Payments (1.2)

| ID | Requirement |
| --- | --- |
| HM-FR-23 | **Where it lives.** `/payments`, in the creator frame, signed-in only (SI-FR-06). Page title "Payments". "Payments" is the second link in the rail and the phone's Deals sheet, under Overview (DC-FR-31, 1.21), marked current here. In order: the line for the year (HM-FR-24), "Paid each month" (HM-FR-12), the payment history with Download CSV (HM-FR-16 to HM-FR-19). Loading and failing as HM-FR-04: if the payments fail, the page says "We couldn't load your payments." with Try again. |
| HM-FR-24 | **The year.** Under the title, one line: "{total} received in {year} · {n} posts" (for one, "1 post"): what the creator received from posts paid this calendar year, in their time zone, from the same rows as the history. Left out while nothing has been paid this year. |
| HM-FR-26 | **Nothing paid yet.** With no paid post, in place of the chart and the history: "Nothing paid yet." and "Each post you're paid for shows here with its PayPal references, ready to download." When anything is held or on its way, a third line says how much: "{held} is held for you and {on its way} is on its way.", leaving out a part that is zero, with a link "See your overview" to `/deals`. No chart, grid or Download CSV. |

### The payment history

| ID | Requirement |
| --- | --- |
| HM-FR-16 | **One row per paid post.** Date paid, brand, post ("YouTube video", "Short", "Reel"), deal amount, Cleared's fee, received, payout reference and hold reference, newest first, each linking to its post. Only paid posts; money on its way is in the overview. Shown once any post has been paid. (1.2) On Payments. |
| HM-FR-17 | **Desktop grid.** From `md:`, AG Grid: sort by date, brand or amount; filter by brand; references in the tabular face, selectable to copy. No sideways scroll at `md:`; lower-priority columns (hold reference, fee) collapse first. |
| HM-FR-18 | **Phone cards.** Below `md:`, one card per row with the same fields in the same order. Both renderings come from one list of rows and show the same thing for every row. |
| HM-FR-19 | **CSV.** "Download CSV" exports the whole history whatever the grid is filtered to, built in the browser, named `cleared-payments-{YYYY-MM-DD}.csv`. Columns: Date paid, Brand, Post, Deal amount, Fee, Received, Payout reference, Hold reference. Amounts as plain decimals ("1140.00"), dates as `YYYY-MM-DD`. Any field starting with `=`, `+`, `-`, `@`, tab or carriage return is prefixed with `'`; fields are quoted per RFC 4180. |

### The flag, responsive and accessibility

| ID | Requirement |
| --- | --- |
| HM-FR-20 | **The flag.** The money sections show only when `NEXT_PUBLIC_PAYMENTS` is "enabled". It stays off until Furqaan's route and its types are in `contract/`; then turning it on is the only change. With it off, home is the deals alone, and nothing says more is coming. (1.2) With it off, `/payments` is the not-found page (EP-FR-01), and there is no Payments link in the rail or sheet and no "See payments". |
| HM-FR-21 | Mobile-first at 375 px: one column, the three totals stacked, the chart full width, history as cards, every target at least 44 px, no sideways scroll. From `lg:` the totals sit in a row. (1.2) From `lg:` the three performance figures sit side by side. |
| HM-FR-22 | Each section a labelled region with its heading; the totals and figures as text, not images; Try again and Download CSV named; loading announced politely; reduced motion respected (no chart animation). |

## Business rules

| ID | Rule |
| --- | --- |
| HM-BR-01 | Nothing on this page moves money or decides a money state. Which stage a post is at, and every amount, is the API's answer; the page only adds and counts. |
| HM-BR-02 | Totals are what the creator receives. The fee is the API's figure, never recomputed here. |
| HM-BR-03 | Every "not paid yet" says why: stuck payouts are named on home (HM-FR-06), and the post says what to do. |
| HM-BR-04 | Brand names are untrusted input: rendered as text, and escaped in the CSV (HM-FR-19). |
| HM-BR-05 | No "coming soon": the money sections are either working or not shown (HM-FR-20). |

## Implementation Decisions

- **Route:** `/deals` becomes home, replacing the first-deal redirect. (1.2) `/deals` is the overview; `/payments` is a new route, rendered only with the flag on.
- **Modules (pure, tested on their own):**
  - **money overview:** payment rows → the three totals with counts, and the stuck list.
  - **performance:** rows → the three figures, each absent with nothing to count, and their values by month.
  - **monthly paid:** rows and a time zone → six months of received amounts, the current month marked.
  - **deal groups:** the deals list → Needs you, Under way, Finished.
  - **history rows:** payment rows → paid rows, newest first, with display words.
  - **CSV:** history rows → the file's text, escaped and quoted.
- **Components:** the overview, figures and charts each their own; the history as one data source with an AG Grid rendering from `md:` and a card rendering below.
- **Data:** `GET /deals` as now; `GET /me/payments` Zod-checked, behind the flag. The client gains `payments()`.
- **Dependencies:** AG Grid Community and AG Charts Community, lazy-loaded; cost and sponsor question in the [ADR](../decisions/2026-10-12-ag-grid-and-ag-charts-on-creator-home.md).
- **Visual:** inherits DESIGN.md. William picked design A, the money card leads (`design/home/option-a.html`; DESIGN.md "Creator home"). The performance figures and the chart share one panel, "How you're doing". (1.2) William picked option 2 of `design/home/payments.html` for the split: "How you're doing" holds the figures alone, the chart is on Payments full width, and Payments opens with the line for the year.

### Requests for Furqaan

| For | Needs |
| --- | --- |
| HM-FR-05 to HM-FR-19 | `GET /me/payments`: one row per post that has ever had a hold, for the signed-in creator only: `dealId`, `deliverableId`, `brandName`, `platform`, `amountMinor`, `feeMinor`, `receivedMinor`, `currency`, `stage` (`held`, `captured`, `paid`, `released`, `closed`), `payout` (`state` as on `CreatorPost`, `reference`, `at`) when captured, `holdReference`, `heldAt`, `deadline`, `publishedAt`, `paidAt`, and `firstCheckPassed` (true, false, or null while no check has finished) |
| HM-FR-15 | Whether a post is waiting on the creator is worked out here from `GET /deals` states; if the API would rather say it (`deliverables[].needsCreator`), the page uses that |
| All | The route and its types in `contract/` |

## Testing Decisions

- Tests check what the creator sees, named after the HM-FR they prove, on per-test stubs typed from the contract (and from the requested shape for payments).
- **Pure modules:** totals across stages, the stuck list past three, received never recomputed; each figure with none, one and several posts; on time at the deadline's edge; months across a time-zone boundary and a year boundary; deal groups for every state; CSV escaping (`=`, `+`, `-`, `@`, quotes, commas, newlines) and the date in the file name.
- **Components:** home with no deals; with deals and the flag off; with the flag on: totals, stuck line linking to the post, figures absent and present, chart text equivalents; history as cards at 375 px and as a grid from `md:`, the same rows in both; Download CSV gives the whole history while filtered; payments failing leaves the deals.
- **1.2:** the overview without the chart and history, with "See payments" under Paid; Payments with the line for the year (shown, left out with nothing paid this year, "1 post"), the chart, the history and CSV; nothing paid yet with and without held or on-its-way money; with the flag off, no Payments link, no "See payments", and `/payments` not found; the rail's Overview and Payments links, each marked current on its page.
- **Live end to end:** by hand until Furqaan's test-session route exists.

## Out of Scope

- How the videos did (views, likes, watch time): needs new scopes and a product decision.
- Tax forms, invoices, currencies other than USD.
- Sharing the figures with a brand.
- A brand's home or dashboard.

## Open items

- **Whether AG Charts counts toward the AG Grid prize** (William, from the hackathon's rules).

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: home at `/deals` replacing the first-deal redirect; three totals after the fee with stuck payouts named; performance as counts; Paid each month and trend lines; deals with Needs you first; one history row per paid post in AG Grid from `md:` and cards below; CSV built in the browser and escaped; money sections behind a flag until `GET /me/payments` exists | [AG Grid and AG Charts on creator home](../decisions/2026-10-12-ag-grid-and-ag-charts-on-creator-home.md), [Frontend on the live API](../decisions/2026-10-11-frontend-on-the-live-api.md) |
| 1.0 | Signed by William | none |
| 1.1 | From the mockups: William picked design A (the money card leads). The lines that explain the totals, the figures and the chart are kept: "What you receive, after Cleared's 5% fee." (HM-FR-05), each figure as a label, a count and a line saying what it counts (HM-FR-08 to HM-FR-10), "What you received" beside the chart (HM-FR-12) | none |
| 1.1 signed | Revision 1.1 signed by William | none |
| 1.2 | From a grill-me with William: home splits into an overview at `/deals` (title and rail link "Overview"; the money overview, How you're doing without the chart, the deals) and Payments at `/payments` (new HM-FR-23: Paid each month, then the history and CSV; second in the rail). New HM-FR-24, the line for the year (William picked option 2 of `design/home/payments.html`); HM-FR-25, "See payments" under Paid; HM-FR-26, nothing paid yet. With the flag off, no Payments page or link | none |
| 1.2 signed | Revision 1.2 signed by William | none |
