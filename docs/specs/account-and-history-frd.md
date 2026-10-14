# Account and history: FRD

**Status:** Signed by William (revision 1.2). Four of its decisions are product behaviour William shares (what deleting an account removes, revoking at Google, how long things are kept, and a test session); they are recorded as Furqaan's for him to agree.

**Surface:** Backend. What William's home, Settings and legal pages have asked for and the contract does not have: a post that was never held, as both sides see it; the creator's payment history; disconnecting an account; deleting the account; how long Sponing keeps things; and a way for end-to-end tests to be signed in on the live backend.

**Scope of this build:** six parts, built one at a time, each with its routes and types in `contract/`. Nothing here moves money or changes a money rule: every amount, state and date is read from the [money path](money-path-frd.md). Deleting an account removes the creator's name and emails from finished money records and changes nothing else in them.

## Problem Statement

Three of William's pages are built and switched off, each waiting on the backend. The home page's money sections have no route to read. Settings cannot disconnect an account or delete one. The legal pages cannot be linked, because nobody has said how long Sponing keeps a draft or how fast it deletes an account, and a page may promise only what the backend does.

Two smaller gaps sit beside them. A post that was never held, or whose hold PayPal never answered, is shown to both sides without the reason. And William's end-to-end tests cannot sign in on the live backend at all, because signing in needs a person at Google's screen, so the last of the frontend's mocks cannot be removed.

One promise is already made and not kept: the signed decision that drafts are deleted 30 days after a post ends has no job behind it.

## Solution

The hold view says when a post was closed without a hold and why, and a declined hold says when PayPal simply never answered. The creator's list of deals carries the same reason, and says which posts are waiting on the creator.

One route gives the creator their payment history: a row for every post that has ever had a hold, with the amounts the money path worked out.

A creator can disconnect YouTube or Instagram, unless a post on that platform is under way. A creator can delete their account, unless a deal is still open. Deleting removes what they made and said, and keeps one anonymous row per post with its amounts, dates and PayPal references. Someone who cannot sign in asks by email, and Furqaan runs a command that does the same thing.

Each thing Sponing keeps gets a stated period and something that enforces it. Drafts get the daily job they were promised.

End-to-end tests get a session through a route that exists only when a secret is set on the server, and can only ever be one fixed test creator.

## User Stories

1. As a creator, I want to see that a post was closed because the brand never held its money, so that I know nothing went wrong on my side.
2. As a brand, I want to be told when PayPal never answered my hold, so that I know nothing was taken and I can try again.
3. As a creator, I want my deals list to say which posts are waiting on me, so that I start with those.
4. As a creator, I want every payment I have been part of in one list, so that I can see what I earned and what is still held.
5. As a creator, I want the fee and what I received as Sponing's own figures, so that the page and PayPal agree.
6. As a creator, I want to disconnect an account I no longer use, so that Sponing stops reading it.
7. As a creator, I want to be told which posts stop me disconnecting, so that I know what to finish first.
8. As a creator, I want Sponing to withdraw its access at Google when I disconnect, so that it is gone on both sides.
9. As a creator, I want to delete my account, so that my videos, my brief and my details are not kept.
10. As a creator, I want to be told what is in the way of deleting, deal by deal, so that I can finish or cancel it.
11. As a creator who lost their Google account, I want to ask for deletion by email, so that I am not stuck.
12. As a brand, I want my email deleted when the deal's records are, so that it is not kept for nothing.
13. As a creator, I want my drafts deleted a month after a post ends, so that an unpublished video does not sit in a bucket.
14. As anyone, I want the privacy page to say how long each thing is kept, so that I can decide whether to use Sponing.
15. As the team, I want every stated period to have something that enforces it, so that the page never promises what nothing does.
16. As the team, I want deleting refused while money is in motion, so that a hold or a payout is never orphaned.
17. As the team, I want the kept money records to carry no name and no email, so that what is kept is only what a payment needs.
18. As William, I want a signed-in session for Playwright on the live backend, so that the whole deal is proven end to end and the mocks can go.
19. As the team, I want that session to be impossible without a secret that is not in the repo, so that a public repo does not hand out sign-ins.
20. As the team, I want the test session to be one fixed creator and never a real account, so that the worst a leaked secret does is use a sandbox account nobody owns.

## Functional requirements

### A post that was never held

| ID | Requirement |
| --- | --- |
| AH-FR-01 | **Closed without a hold.** A post the money path closed without a hold (MP-FR-08, MP-FR-34) shows its hold as `not_held`, with why: `never_held` (no hold 7 days after the brand agreed) or `cancelled`. Today it shows as not started. |
| AH-FR-02 | **A hold PayPal did not answer.** A declined hold says why: `paypal_declined`, or `timed_out` when PayPal gave no answer in 24 hours and the attempt was cancelled (MP-FR-07). Either way nothing was taken and the brand can try again. |
| AH-FR-03 | **On the creator's list of deals.** A post whose state is `closed` carries the same reason, `never_held` or `cancelled`. |
| AH-FR-04 | **Waiting on the creator.** Each post on the creator's list of deals says whether its next step is the creator's, as the backend already works out for the deal's status. |

### The creator's payment history

| ID | Requirement |
| --- | --- |
| AH-FR-05 | **`GET /me/payments`.** One row for every post of the signed-in creator that has ever had a hold, newest hold first. No other creator's rows, and nothing for a brand. |
| AH-FR-06 | **Each row:** the deal's and the post's ids, the brand's name, the platform, the amount, the currency, the stage (`held`, `captured`, `paid`, `released` or `approved_not_paid`), the hold's PayPal reference and when it was held, the deadline, when the post was published, when it was paid, and whether its first draft check passed every item. |
| AH-FR-07 | **Amounts are the money path's.** The amount is always there. The fee and what the creator receives are there once the hold is taken, as the money path worked them out at capture (MP-FR-24, MP-FR-27), and are never recomputed here. All are whole minor units. |
| AH-FR-08 | **The payout,** once the hold is taken: its state as on the creator's post, its PayPal reference and when. The PayPal email is not in the history. |
| AH-FR-09 | **Passed first time.** When a post's first draft check finishes, whether every item passed is recorded with the post. It is true, false, or absent while no check has finished. |
| AH-FR-30 | **Why a hold ended (1.2).** A row whose stage is `released` or `approved_not_paid` also carries `releasedBecause` (`deadline`, `cancelled`, `day_28`, `fix_window_ended`, `not_accepted`, `ruled_not_to_pay` or `hold_not_confirmed`, the same words the creator's post uses), `releasedAt` (when the release was decided), and, when the reason is `cancelled`, `cancelledBy` (`creator` or `brand`). They are read from the money path's release record, never worked out here (AH-BR-01). Other rows carry none of them. |

### Disconnecting an account

| ID | Requirement |
| --- | --- |
| AH-FR-10 | **`DELETE /connect/{platform}`,** for `youtube` or `instagram`. The stored access and the connected account are deleted, and the answer is the creator's profile. Asked for an account that is not connected, it answers the profile as it is. |
| AH-FR-11 | **Refused while a post is under way.** While a post on that platform is held and not yet paid or released, the answer is 409 `post_under_way`, listing each such post: the deal's and post's ids, the brand's name and the platform. Nothing is deleted. |
| AH-FR-12 | **The profile says so first.** Each connected account on the profile says whether it is in use by such a post, so the page can leave Disconnect out. |
| AH-FR-13 | **Withdrawn at Google.** Once the stored access is deleted, Google is asked once to revoke it ([decision](../decisions/2026-10-12-disconnecting-deletes-then-revokes-at-google.md)). If Google does not answer, the disconnect has still happened. Instagram has no such call: its token is deleted and ends on its own within 60 days. |
| AH-FR-14 | **Afterwards** the creator connects again as before. A post on that platform that is not yet held is not touched: its terms cannot be sent, and its go-ahead is refused, until the account is connected again (IG-FR-08, PT-FR-07, IG-FR-13). |

### Deleting the account

| ID | Requirement |
| --- | --- |
| AH-FR-15 | **`DELETE /me`.** The account is deleted, every session of the creator ends, and the answer is 204 with the session cookie cleared. |
| AH-FR-16 | **Refused while anything is open.** The answer is 409 `deal_open`, listing each deal in the way once, with the brand's name and the first reason that applies: `held` (a post is held), `payout` (a hold was taken and its payout is not settled), or `waiting_for_brand` (the terms are with the brand, or the brand agreed and a post is neither held nor closed). Nothing is deleted. A deal the brand was never invited to is never in the way. |
| AH-FR-17 | **What is deleted** ([decision](../decisions/2026-10-12-deleting-an-account-keeps-the-money-records.md)): the profile (name, email, PayPal email, Google's id for the creator); the connected accounts and their tokens; every session; every draft and everything read from it; each deal's brief, checklist, questions, notes, terms, check results and evidence, live-check results, and the brand's email; every invite and review link. |
| AH-FR-18 | **What is kept:** for each post that ever had a hold, its money records: the amounts, the dates, the stage, the PayPal references, and the money path's own record of what happened. With them stay the deal's and the post's ids, the brand's name and the platform. The creator's name, email and PayPal email are removed from all of it. Nothing kept points to a person. |
| AH-FR-19 | **The brand's side.** The brand's links to those deals stop working, and its sessions for them end, with the same answer as any link that no longer works. |
| AH-FR-20 | **In order.** The records are removed in one change, at once. Files in the bucket are deleted by a job within 24 hours, tried again until done. Google is then asked to revoke, as in AH-FR-13. |
| AH-FR-21 | **Signing in again** with the same Google account makes a new, empty account. Nothing is restored. |
| AH-FR-22 | **By email.** A request by email is done within 30 days by Furqaan, with a command run on the server that takes the Google email. It runs the same code as the route, is refused for the same reasons and prints what is in the way, and asks for the email to be typed again before it deletes. |

### How long things are kept

| ID | Requirement |
| --- | --- |
| AH-FR-23 | **Drafts get their job.** A daily job deletes every draft of a post, with what was said in it, its on-screen text and its frames, 30 days after the post is paid, released, closed, or approved and not paid ([decision](../decisions/2026-10-09-who-can-watch-a-draft-and-how-long-it-is-kept.md), which had no job). The check's results stay with the deal. |
| AH-FR-24 | **The periods** ([decision](../decisions/2026-10-12-how-long-cleared-keeps-things.md)), each with what enforces it: |

| What | Kept | Enforced by |
| --- | --- | --- |
| Drafts, and the speech, on-screen text and frames read from them | 30 days after the post ends | The daily job (AH-FR-23); the bucket's 90-day rule behind it |
| A live Reel's fetched video | Until its match is decided, minutes | The live check (IG-FR-20) |
| The brief, checklist, notes, check results and their evidence, the brand's email | While the creator's account exists | Deleting the account (AH-FR-17) |
| Access to YouTube and Instagram | Until disconnected, lost, or the account is deleted | AH-FR-10, AH-FR-17, IG-FR-06 |
| Payment records | For as long as Sponing runs, with no name or email once the account is deleted | AH-FR-18 |
| The account itself, after deleting | Gone at once; files within 24 hours | AH-FR-20 |
| Sessions | 14 days after last use | DS-FR-03 |
| Server logs, which carry ids only | 30 days | Log rotation on the server, set by Furqaan |

### A session for end-to-end tests

| ID | Requirement |
| --- | --- |
| AH-FR-25 | **Off unless a secret is set.** `POST /test/session` exists only when the server has a test secret of at least 32 characters ([decision](../decisions/2026-10-12-a-test-session-behind-a-secret.md)). Without one it answers as any path that does not exist. |
| AH-FR-26 | **The secret is the way in.** The caller sends the secret in a header. It is compared in constant time. A missing or wrong secret gets the same answer as a path that does not exist, and the denial is logged without the value sent. |
| AH-FR-27 | **One fixed test creator.** The route signs the caller in as one creator kept for tests, made the first time it is asked for. It sets the same session cookie a Google sign-in sets and answers the profile. It takes no name, email or id, and can never sign in as any other account. |
| AH-FR-28 | **An ordinary creator otherwise.** The test creator has every limit a creator has, the PayPal sandbox like everyone, and no YouTube or Instagram connected by this route. |
| AH-FR-29 | **A limit.** At most 120 sessions an hour are made this way, overall. Over that the answer is 429. |

## Business rules

| ID | Rule |
| --- | --- |
| AH-BR-01 | No route or job here moves money or decides a money state. Amounts, stages and dates are read from the money path. |
| AH-BR-02 | An account is never deleted while a hold is in place, a payout is unsettled, or a brand may still hold. The money path is left nothing to finish for a creator who is gone. |
| AH-BR-03 | Deleting changes a kept money record in one way only: the creator's name, email and PayPal email are removed. Amounts, dates, stages and PayPal references are never altered. |
| AH-BR-04 | Every route checks the session and acts only on the caller's own account. A refusal lists only the caller's own deals. |
| AH-BR-05 | A brand is never shown the payment history, a payout's state, or the creator's PayPal email. |
| AH-BR-06 | Stored access is deleted before a platform is asked to revoke it, and a platform failing never keeps it. A token is never logged or returned. |
| AH-BR-07 | Amounts are whole minor units. Nothing is worked out with fractions. |
| AH-BR-08 | A period is stated only with what enforces it. If nothing in the code or on the server does, it is not stated. |
| AH-BR-09 | The test secret is never in the repo, a log, an error or an answer. Without it there is no route. With it, the caller is the one test creator and nobody else. |
| AH-BR-10 | Logs carry ids only: creator, deal and deliverable ids, counts and timings. Never a name, an email or a token. |

## Implementation Decisions

- **Modules.** Each is a small interface with its tests:
  - **The hold view** gains the two reasons. It is pure code over the money state, which already records both.
  - **The payment history:** a pure function from one post's money view to its row, and a reader that lists the creator's posts that had a hold.
  - **Account removal:** one module with two questions and two actions: what is in the way of disconnecting a platform, what is in the way of deleting, disconnect, and delete. The routes and the command both call it.
  - **A Google revoke** on the Google port: one plain HTTPS call.
  - **The retention job:** a daily job that finds posts ended 30 days ago with drafts still kept.
  - **The test session:** one route, registered only when the secret is set.
  - **Routes:** thin. Each checks the session, validates, calls a module and maps the answer.
- **The money path is not changed.** It gains one function that removes the creator's name and emails from a finished deliverable's record, refused unless the deliverable is paid, released, closed, or approved and not paid.
- **Schema.** A deal can outlive its creator: it no longer has to point at one. A post's check records whether its first run passed. Nothing else is new.
- **Deleting** is one transaction for the records. The files are a job written in that transaction, as every job is.
- **The test route and the origin check.** A request from a test runner carries no origin, so this one path is let past the check that turns away requests from other sites, as PayPal's webhook is. The secret is its guard.
- **No new library.**
- **Settings:** the test secret (`TEST_SESSION_SECRET`, unset by default); how many days after a post ends its drafts go (30); the hourly limit on test sessions (120).
- **Cost.** None on AWS beyond deleting sooner.

### Requests for William

| For | Needs |
| --- | --- |
| Confirm and hold, invite, cancel (CN "their own revision next") | The hold's state gains `not_held` with `because`: `never_held` or `cancelled`. A `declined` hold gains `reason`: `paypal_declined` or `timed_out`. A `closed` post on `GET /deals` gains `closedBecause`. Each post there gains `needsCreator` |
| Home (HM-FR-05 to HM-FR-19) | `GET /me/payments` as asked, with three differences: `stage` has no `closed` (a row is a post that had a hold) and has `approved_not_paid`; `feeMinor` and `receivedMinor` are absent until the hold is taken; there is no PayPal email |
| Settings (ST-FR-07, ST-FR-08) | `DELETE /connect/{platform}` and `accounts[].inUse`, as asked |
| Settings (ST-FR-10, ST-FR-11) | `DELETE /me`, as asked. The confirmation's wording should match AH-FR-17 and AH-FR-18: the brief, checklist and check results go too, not only the profile, accounts and drafts |
| Legal (LG-FR-08, LG-FR-13) | The periods in AH-FR-24, and "within 30 days" for a request by email |
| Legal (LG-FR-07) | The processor list is right: PayPal, Amazon Web Services (which includes the models that read briefs and check drafts), Google, Meta, Resend, Vercel. The backend sends errors to no monitoring service |
| Playwright | `POST /test/session` with the secret in the `X-Test-Secret` header; the answer sets the session cookie. The secret goes in CI's secrets. A route to end a review window is not part of this spec |
| All pages | The generated types in `contract/` gain these as each part is built |

## Testing Decisions

- A good test here states a situation and checks what someone could observe: the answer a route gives, what each side is shown, the rows that exist afterwards, the files left in the bucket, and which calls reached Google. Tests are named after the AH-FR or AH-BR they prove.
- **Tooling:** as the other backend specs. Bun's test runner, the Docker Postgres, the fake PayPal, and the stand-ins for Google, storage and the rest.
- **1.2:** each release reason gives its `releasedBecause` and `releasedAt`; a cancel by each side gives `cancelledBy`; a ruling not to pay reads `ruled_not_to_pay`; an approved, not paid row carries its reason and date; held, captured and paid rows carry none; the contract lists the three fields.
- **The payment history** is tested as a table over the money path's stages: held, captured with each payout state, paid, released, approved and not paid; amounts in minor units against the money path's own; another creator's posts never listed; a post never held never listed.
- **Deleting** gets the most attention. For each reason in AH-FR-16, the refusal and nothing deleted. For a finished deal: every table checked for what is gone and what stays, the kept money records compared field by field with before, and no name or email anywhere in them. The brand's link refused afterwards. Files gone after the job. Signing in again gives an empty account.
- **Disconnecting:** refused with each post in the way; the token gone before Google is asked; Google failing changes nothing; another creator's connection untouched.
- **The retention job:** a post ended 29 days ago keeps its draft and one ended 30 days ago loses it; the check's results stay; a post still under way is never touched.
- **The test session:** no route without the secret; a wrong secret answered as no route; the session is the fixed test creator's whatever is sent; the limit; the secret in no log.
- **The command** is tested through the module it calls, and once as a command for its refusal and its confirmation.

## Out of Scope

- **A route to end a review window for tests.** It moves a deal's clock, so it gets its own questions.
- **Meta's data-deletion callback,** after the hackathon.
- **Giving a creator a copy of their data.** Asked for by email and done by hand.
- **Restoring a deleted account.**
- **A fixed end for payment records.** They are kept for as long as Sponing runs.
- **Paging the payment history.** Every row is returned.
- **Rotating logs from code.** It is set on the server.

## Open items

**Added while drafting and accepted by Furqaan at sign-off.** These were not asked in the question session; they are listed so the source of each is clear.

- **AH-FR-04:** each post on the list of deals says whether it is waiting on the creator.
- **AH-FR-06:** the stage `approved_not_paid` is in the history, and `closed` is not.
- **AH-FR-09:** "passed first time" is recorded from now on. For a post checked before this is built it is worked out only if one check ran, and is otherwise absent.
- **AH-FR-11:** "under way" for disconnecting is held or taken and not yet paid, as William's page words it, although nothing is read from the platform once the hold is taken.
- **AH-FR-16:** a deal the brand agreed with a post not yet held counts as waiting on the brand, so deleting is refused until that post is held, cancelled or closed after 7 days.
- **AH-FR-22:** the command asks for the email twice.
- **AH-FR-26:** a wrong secret is answered as if there were no route, not as a refusal.
- **AH-FR-29:** 120 test sessions an hour.

**Not settled here.**

- A brand that asks for its own email to be deleted while the creator's account exists. It is done by hand, and nothing is built for it.
- Whether tests need the test creator put back to new (not yet welcomed, no deals). The route does not do that.

**Needs doing by a person.**

- Log rotation on the server at 30 days, before the legal pages are linked.
- The test secret made (`openssl rand -base64 48`), set on the server and in CI's secrets.
- A check that the bucket's 90-day rule covers every key, not only those under `drafts/`.
- The session cookie is not sent from the app's present address to the API's, because they are different sites. Until the app is on the API's domain, a test session will look signed out in a browser, as a real one does.

**Waiting on William.** The requests in the table above, and his agreement to the four shared decisions.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the question session with Furqaan: deleting an account removes what the creator made and said and keeps anonymous money records; disconnecting deletes stored access and then asks Google to revoke it; drafts 30 days after a post ends, with the job the earlier decision lacked, and the rest kept with the account; a request by email done within 30 days with a command; a test session behind a secret for one fixed test creator, and no other test route. The not-held states and the payment history follow William's requests | [Deleting an account](../decisions/2026-10-12-deleting-an-account-keeps-the-money-records.md), [disconnecting](../decisions/2026-10-12-disconnecting-deletes-then-revokes-at-google.md), [how long things are kept](../decisions/2026-10-12-how-long-cleared-keeps-things.md), [a test session](../decisions/2026-10-12-a-test-session-behind-a-secret.md) |
| 1.0 | Signed by Furqaan, with the eight items added while drafting accepted as written | none |
| 1.1 | The product is named Sponing: wording only, no behaviour changes. "Cleared" stays as the paid status | [The product is named Sponing](../decisions/2026-10-14-the-product-is-named-sponing.md) |
| 1.1 signed | Revision 1.1 signed by William | none |
| 1.2 | From William, for the Payments page's Not paid list (HM 1.8): released and approved-not-paid rows carry why the hold ended, when, and who cancelled (AH-FR-30) | none |
| 1.2 signed | Revision 1.2 signed by William | none |
