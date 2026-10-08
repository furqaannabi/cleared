# Money path: FRD

**Status:** Signed by Furqaan (revision 1.4). The shared product rules in it (the fee, cancelling, unheld posts, who decides a payment the live check cannot, and the fix window) are decided by Furqaan; William can supersede them.

**Surface:** Backend. Everything that happens to one deliverable's money, from the brand approving a hold to the deliverable being cleared or its hold being released: steps 3, 6 and 8 of [How a deal runs](../PRODUCT.md#how-a-deal-runs), and the money side of every row in [When something does not go to plan](../PRODUCT.md#when-something-does-not-go-to-plan).

**Scope of this build:** the money path as tested functions inside the backend service, the jobs that run its timers, the one public route PayPal needs (the webhook), and a script that drives a real sandbox hold end to end. The brand's and creator's routes are **not** built here: they need the link, the session and the agreement, which belong to the next backend spec. "The brand agreed", "the draft is cleared to publish" and every live check result are inputs this spec trusts and its tests supply. PayPal sandbox only.

## Problem Statement

A brand that reserves money for a post needs to know that it is reserved and not taken, that it is taken only when the post it approved is live, and that it comes back if the creator does not deliver. A creator needs to know, before publishing something that cannot be unpublished, that the money is really there, and afterwards exactly where the payment stands and why.

Both of those are promises about money, and money breaks in ways the happy path hides: PayPal answers late or not at all, a request is sent twice, a guarantee lapses, a payout goes to an email with no account, a deadline passes while a check is still running. If any of those is handled by guesswork, someone is charged twice, paid twice, or left unpaid with no explanation, which is the problem Cleared exists to fix.

## Solution

One money module owns every change to a deliverable's money. Each deliverable has one hold. The brand approves it with PayPal, and the money is reserved. Before the creator publishes, Cleared re-confirms the hold with PayPal and gives a go-ahead that lasts 48 hours. Once the approved post is live and checks out, the hold is captured to Cleared's PayPal account and the creator is paid the amount less Cleared's 5% fee. If the creator does not post in time, or the deal is cancelled before the go-ahead, the hold is released to the brand.

Every case in between has one defined outcome with a reason both sides can be shown. Nothing stays undecided past day 28 of a hold, one day before PayPal would end it. Every PayPal call carries a request id, the recorded state is checked before each call, and a checker job and verified webhooks settle anything PayPal did not answer clearly, so no step is ever repeated blindly.

## User Stories

**The brand**

1. As a brand, I want approving a hold to reserve my money without taking it, so that I only pay for a post that is delivered.
2. As a brand, I want one hold per post, each handled on its own, so that a problem with one post does not affect the others.
3. As a brand, I want a closed or declined PayPal window to leave nothing held, so that I can simply try again.
4. As a brand, I want to be unable to approve the same post twice, so that I am never held twice.
5. As a brand, I want a hold attempt PayPal never answers to be cancelled after a day, so that the post is not stuck.
6. As a brand, I want my money taken only after the post I approved is live and checked, so that I never pay for something I did not get.
7. As a brand, I want never to be charged more than the amount I approved, so that the terms mean what they say.
8. As a brand, I want my hold released if the creator does not post by the deadline, so that my money is not tied up.
9. As a brand, I want to be able to cancel a post before the creator is cleared to publish, so that I can walk away while nothing is lost.
10. As a brand, I want to be told if PayPal cannot confirm my hold, so that I can fix my funding before the creator's deadline.
11. As a brand, I want to be shown a live post the check could not confirm, with exactly what was not confirmed, so that I can say whether to pay.
12. As a brand, I want to object to paying for a live post with a reason, so that a person looks at it before money moves.
13. As a brand, I want to be told when a payment for an approved post failed at PayPal, so that I can put it right.
14. As a brand, I want every stage to show its PayPal reference, so that I have a record.
15. As a brand, I want any hold still undecided on day 28 returned to me, so that nothing is left hanging.

**The creator**

16. As a creator, I want to see that a post is held, for how much and until when, so that I know it is safe to start.
17. As a creator, I want Cleared to confirm the money is still there before I publish, so that I never publish against a hold that has gone.
18. As a creator, I want to know how long my go-ahead lasts, so that I publish while the money is guaranteed.
19. As a creator, I want to be told not to publish, and why, when PayPal cannot confirm the hold, so that I do not post for nothing.
20. As a creator, I want to ask for the go-ahead again later, so that a temporary problem with the brand's funding does not end the deal.
21. As a creator, I want a post I published in time to keep its hold even if the check runs after the deadline, so that I am not punished for timing I do not control.
22. As a creator, I want the chance to fix a wrong link or code after publishing, so that a typo does not cost me the payment.
23. As a creator, I want silence from the brand to pay me when my post is live and only a manual check is outstanding, so that I am not left waiting.
24. As a creator, I want the brand to be unable to cancel once I have the go-ahead or have published, so that the money cannot be pulled while I deliver.
25. As a creator, I want to be able to cancel a post I am not going to make, so that the brand gets its money back early.
26. As a creator, I want to see the fee and exactly what I will receive, so that the payout is never a surprise.
27. As a creator, I want to be paid as soon as the hold is captured, so that there is no second wait.
28. As a creator, I want a payout that did not arrive to say why and what to do, so that I can fix it myself.
29. As a creator, I want to correct my PayPal email and have the payout sent again, so that a wrong address does not lose my money.
30. As a creator, I want never to be shown "Paid" until PayPal says the money arrived, so that I can trust the word.
31. As a creator, I want to know when the brand's payment is failing at PayPal, so that I understand why I am not paid yet.

**Cleared (the team)**

32. As the team, I want every money change to happen in fixed code and never from a model's output, so that an AI mistake cannot move money.
33. As the team, I want every PayPal call to be safe to send twice, so that a crash or a retry cannot double-charge or double-pay.
34. As the team, I want an unclear answer from PayPal to be checked, not retried blindly, so that we never act on a guess.
35. As the team, I want webhooks verified with PayPal and counted once, so that a forged or repeated event changes nothing.
36. As the team, I want an unchangeable record of every money change with its cause, so that any dispute can be answered from the record.
37. As the team, I want timers to survive the service restarting, so that a deadline is late at worst and never lost.
38. As the team, I want a job that keeps failing to be marked and visible, so that a stuck payment is noticed.
39. As the team, I want to rule on a brand's objection before day 28, so that a disputed post has an answer.
40. As the team, I want to drive a real sandbox hold from a script, so that re-confirming can be tested on a hold more than 3 days old.
41. As the team, I want the service to be unable to talk to live PayPal, so that no real money can ever move.

## Functional requirements

### Starting and approving a hold

| ID | Requirement |
| --- | --- |
| MP-FR-01 | **Start a hold.** For a deliverable whose terms the brand has agreed, the module creates a PayPal order to authorize the deliverable's amount and returns its order id. Each start is one hold attempt. |
| MP-FR-02 | **When a start is refused.** A start is refused, each with its own reason, when: the brand has not agreed; the deliverable is already held; an earlier attempt is pending or unknown; the deliverable was closed as not held (MP-FR-08) or cancelled; or the amount is outside the limits (MP-FR-09). Nothing is sent to PayPal. |
| MP-FR-03 | **Approved.** Given the order id PayPal approved, the module authorizes it and records one outcome for the attempt: held, declined, pending or unknown. An order id that belongs to another deliverable is refused. |
| MP-FR-04 | **Held.** On a held outcome the module records the PayPal reference and the time, and fixes three moments from it: the **deadline** (23:59 in the creator's timezone, the agreed number of days later, per the [deadline decision](../decisions/2026-10-06-deadline-shared-date-with-local-time.md)), the **guarantee end** (3 days later) and **day 28** (28 days later). It schedules the deadline job (MP-FR-22) and the day 28 job (MP-FR-23). |
| MP-FR-05 | **Closed.** When the brand closes PayPal without approving, the attempt is recorded as closed. Nothing is held and a new start is allowed. |
| MP-FR-06 | **Pending and unknown.** A pending answer from PayPal, or no clear answer, leaves the attempt pending or unknown. The checker (MP-FR-38) asks PayPal until it has a final answer. No new start is allowed meanwhile. |
| MP-FR-07 | **A stuck attempt.** An attempt still pending or unknown 24 hours after it was approved is cancelled with PayPal and recorded as declined, with the reason that PayPal did not answer in time. Nothing was taken and a new start is allowed. |
| MP-FR-08 | **Never held.** A deliverable with no hold 7 days after the brand agreed is closed as not held. Other deliverables in the deal are unaffected. No start is allowed after that. |
| MP-FR-09 | **Amount limits.** A hold is at least $20.00 and at most $10,000.00, both set in configuration. The check is offered as a function, so the terms can be refused when they are saved, and it runs again at MP-FR-01. |

### The go-ahead to publish

| ID | Requirement |
| --- | --- |
| MP-FR-10 | **Asking for the go-ahead.** For a held deliverable whose draft is cleared to publish, before its deadline, the module re-confirms the hold and answers one of: go-ahead until a stated time, not confirmed with a reason, or wait until a stated time. |
| MP-FR-11 | **Inside the guarantee.** While PayPal's guarantee is running, re-confirming asks PayPal whether the hold is still in place. If it is, the go-ahead is given. |
| MP-FR-12 | **After the guarantee.** Once the guarantee has ended, re-confirming asks PayPal to renew it. On success the new PayPal reference is recorded and the guarantee end moves to 3 days later. |
| MP-FR-13 | **How long it lasts.** A go-ahead lasts 48 hours, but never past 24 hours before the guarantee ends and never past the deadline. If that leaves no time (a hold late in its first 3 days, which PayPal cannot renew yet), the answer is "wait until" the guarantee end, when it can be renewed. **When the deadline falls before the guarantee ends, the 24-hour margin does not apply:** the go-ahead lasts 48 hours or until the deadline, whichever is sooner, and the answer is never "wait until". PayPal guarantees the funds past such a deadline, and waiting for a renewal would leave the creator no time to publish. |
| MP-FR-14 | **Not confirmed.** If PayPal cannot confirm or renew the hold, no go-ahead is given. The hold stays in place, a notice for the brand is recorded (check your PayPal funding), and the creator can ask again. |
| MP-FR-15 | **When a go-ahead runs out.** At its end time the module asks whether a post was published (MP-FR-16). If one was, the go-ahead is kept and the deliverable waits for its live check. If not, the go-ahead ends and the creator must ask again. |

### After publishing

| ID | Requirement |
| --- | --- |
| MP-FR-16 | **Published.** The module records when an approved post was published, as reported by the live check. It can also ask the live check, through one interface, whether a post has been published; tests supply the answer. |
| MP-FR-17 | **Live check passed.** The hold is captured (MP-FR-24). |
| MP-FR-18 | **Live check cannot decide.** The brand has 48 hours to confirm or to object with a reason. Confirming, or saying nothing for 48 hours, captures the hold. Objecting sends the deliverable to a person at Cleared (MP-FR-19). |
| MP-FR-19 | **Cleared's ruling.** A person at Cleared rules to pay, which captures the hold, or not to pay, which releases it. Until a route exists for it, the ruling is made through the sandbox script. |
| MP-FR-20 | **Live check failed, fixable.** The creator has a fix window: until the deadline, or until 24 hours after the failure was reported if that is later. Each new result within it is handled as it comes (MP-FR-17, MP-FR-18). If the post still fails when the window ends, the hold is released. |
| MP-FR-21 | **Live check failed, not fixable.** The brand has 48 hours to accept the post anyway, which captures the hold. Without an acceptance the hold is released. Silence does not pay here. |
| MP-FR-22 | **The deadline.** At the deadline the module asks whether an approved post was published in time. If so, the hold is kept until the steps above finish. If not, the hold is released. When the last request for a go-ahead was not confirmed, the release reason says the brand's hold could not be confirmed. |
| MP-FR-23 | **Day 28.** A hold that is neither captured nor released on day 28 is released, with that reason. If an approval to pay was already on record (MP-FR-25), the deliverable ends as approved, not paid. |

### Capture and payout

| ID | Requirement |
| --- | --- |
| MP-FR-24 | **Capture.** With an approval on record (MP-FR-17, 18, 19 or 21), the module captures the hold in full to Cleared's PayPal account and records the PayPal reference. **If the hold's guarantee has ended, the hold is re-confirmed first,** as it is before a retry (MP-FR-25). |
| MP-FR-25 | **Capture refused.** If PayPal refuses the capture, the module tries again every 6 hours until day 28, re-confirming the hold first when PayPal allows it. A notice is recorded for each side: for the creator, that the post is approved but PayPal could not collect from the brand; for the brand, that its payment failed and to check its PayPal funding. If no attempt succeeds by day 28, the hold is released and the deliverable ends as approved, not paid. |
| MP-FR-26 | **Capture not answered.** If PayPal gives no clear answer to a capture, the same request is checked or resent with the same request id until it is settled. A second capture is never started. |
| MP-FR-27 | **The fee.** Cleared's fee is 5% of the deliverable's amount, set in configuration, worked out in whole cents and rounded down. The creator's payout is the amount less the fee. Both figures are recorded at capture. PayPal's own charges come out of the fee and are not passed on. |
| MP-FR-28 | **Payout.** As soon as the capture completes, the module sends the payout to the creator's PayPal email as it stands at that moment. |
| MP-FR-29 | **Payout results.** The deliverable is paid only when PayPal reports the payout succeeded. Until then it stays captured, with the reason and the next step: sending; unclaimed (the creator must accept the money at that email); or failed, returned, blocked or denied (the creator must correct their PayPal email and send it again). |
| MP-FR-30 | **Sending a payout again.** The creator can have the payout sent again only when the last one has finished without paying. An unclaimed payout is first cancelled with PayPal, and a new one is sent only once PayPal confirms the cancellation. There is never more than one payout in flight. |
| MP-FR-31 | **Cleared.** A deliverable whose payout succeeded is cleared. Nothing more can happen to its money. |
| MP-FR-45 | **Payout PayPal will not send.** If PayPal refuses to send a payout at all, nothing has been sent and the reason lies with Cleared's own PayPal account (for example its balance, or what the account is allowed to do), not with the creator. The deliverable stays captured. The same payout is sent again every 6 hours under the same request id, so it can never be sent twice, and there is no end date: the money is already captured, so it keeps trying until it is sent. At the first refusal a notice is recorded for a person at Cleared, and one for the creator: the payout is delayed on Cleared's side and there is nothing they need to do. The creator cannot ask for it to be sent again meanwhile (MP-FR-30). |

### Release and cancel

| ID | Requirement |
| --- | --- |
| MP-FR-32 | **Release.** Releasing cancels the hold with PayPal and records when and why: deadline passed, cancelled (and by whom), day 28, fix window ended, not accepted by the brand, or ruled by Cleared. If PayPal reports the hold already ended, the deliverable is recorded as released. |
| MP-FR-33 | **Cancelling a held deliverable.** The creator or the brand can cancel while there is no go-ahead and no post has been published. Cancelling releases the hold. While a go-ahead is running, or once a post is published, a cancel is refused with that reason. |
| MP-FR-34 | **Cancelling before the hold.** Cancelling a deliverable that is not yet held closes it. Any attempt in progress is cancelled with PayPal first. |

### Webhooks and the checker

| ID | Requirement |
| --- | --- |
| MP-FR-35 | **The webhook route.** One public route receives PayPal's events. Each is verified with PayPal before anything else happens. An event that fails verification is rejected and the rejection is logged. |
| MP-FR-36 | **Counted once.** A verified event is stored under its PayPal event id. An event id seen before is acknowledged and ignored. |
| MP-FR-37 | **What an event can do.** A verified event goes through the same transition rules as the module's own calls. It can settle a pending or unknown attempt and report a payout's result. It can never reverse a finished stage, and an event that fits no allowed change is logged and ignored. |
| MP-FR-38 | **The checker.** Any PayPal call recorded as started without a final answer is followed up by a job that asks PayPal for the real status, backing off between tries. It works without webhooks, so the service runs on a laptop with no public address. |
| MP-FR-39 | **After capture.** A refund, reversal or dispute reported after a capture is recorded and the deliverable is marked for a person at Cleared. No money is moved in response. |

### What can be read

| ID | Requirement |
| --- | --- |
| MP-FR-40 | **The money view.** For each deliverable the module can return: the stage; the amount, fee and payout as decimal strings; each stage's PayPal reference and time; the deadline, the go-ahead's end and day 28; and, for every stage short of paid, a reason and the next step. It supplies the hold state per post that the confirm and hold spec shows, and the fields the draft check spec's money card needs. The brand's view never includes the creator's PayPal email. |
| MP-FR-41 | **The money record.** Every change of stage, every PayPal call and its answer, and every notice is appended to a record with its cause (a function call, a job or a webhook), its time and its PayPal reference. Entries are never changed or removed. |

### Jobs

| ID | Requirement |
| --- | --- |
| MP-FR-42 | **Jobs in Postgres.** Timers and retries are rows in a jobs table, each with the time it is due. A job is written in the same database transaction as the money change it belongs to. A due job is claimed under a row lock, so it runs once even with more than one worker. |
| MP-FR-43 | **Late, never lost.** A job that fails is tried again with a growing delay. After a set number of tries it is marked failed and logged, and stays in the table. A job that fell due while the service was down runs when it comes back. |

### The sandbox script

| ID | Requirement |
| --- | --- |
| MP-FR-44 | A development-only script creates a test deliverable, starts a hold, prints PayPal's approval link for a sandbox buyer, and then steps through each function above against the real sandbox: approve, go-ahead, publish and live check results, capture, payout, cancel, release and Cleared's ruling. It refuses to run in production. |

## Business rules

| ID | Rule |
| --- | --- |
| MP-BR-01 | Money changes only in this module's fixed code. No model output is ever an input to it; the live check results it accepts are decided by fixed code elsewhere. |
| MP-BR-02 | One hold per deliverable, for that deliverable's amount, in US dollars. A deliverable has at most one hold attempt in progress. |
| MP-BR-03 | A capture is always for exactly the amount held, and happens at most once per hold. |
| MP-BR-04 | No capture without an approval on record. No payout without a completed capture. A payout is never more than the amount less the fee, and at most one payout per capture ever succeeds. |
| MP-BR-05 | Amounts are stored as whole cents and exchanged as decimal strings with two places. No amount is ever a floating-point number. |
| MP-BR-06 | Every call that creates or moves money (create, authorize, renew, capture, cancel, payout) carries a request id. One attempt has one id. A call with no clear answer is checked or resent with the same id; a new attempt with a new id is made only after PayPal has clearly refused the last one. |
| MP-BR-07 | Before any PayPal call the deliverable's recorded state is locked and checked, and the attempt is recorded as started. The answer, the change of stage and any follow-up job are recorded together afterwards. |
| MP-BR-08 | Paid, released, approved not paid, and closed as not held are final. Nothing changes a deliverable's money after it reaches one of them. |
| MP-BR-09 | While a go-ahead is running, or once a post is published, a hold is released only by the fix window ending, the brand not accepting a failed post, Cleared's ruling, or day 28. |
| MP-BR-10 | Sandbox only. The PayPal address is fixed to the sandbox in code and cannot be changed by configuration. |
| MP-BR-11 | PayPal's secret and webhook id are server-side configuration, never in code or logs. Logs carry deliverable ids, attempt ids and PayPal reference ids only: no payloads, no emails, no tokens. |
| MP-BR-12 | An event that fails verification changes nothing. |
| MP-BR-13 | A brand's objection reason is untrusted plain text. It is stored and shown as text and never acted on. |
| MP-BR-14 | The creator's PayPal email appears in nothing the brand can read. |
| MP-BR-15 | Every stage short of paid carries a reason and a next step. There is no state that only says "processing". |

## Implementation Decisions

- **One money module** with a small set of functions: start a hold, approved, closed, ask for the go-ahead, record published, take a live check result, the brand's confirm, accept and object, Cleared's ruling, cancel, send the payout again, and read the money view. Everything else in the service, including the routes built later, calls these and nothing deeper.
- **A pure transition function** inside it: given the current state and an event (a call, a job falling due, a PayPal answer, a webhook), it returns the next state and what to do next, or a refusal with a reason. It has no database or PayPal access and is tested on its own. Own calls, jobs and webhooks all go through it.
- **A PayPal port:** one interface for create order, authorize, read status, renew, capture, cancel, send payout, read payout, cancel payout and verify webhook. The real one uses PayPal's server SDK for Orders and Payments and plain HTTP for Payouts and webhook verification ([decision](../decisions/2026-10-08-paypal-client-sdk-behind-port.md)). Tests use a fake.
- **A published-post port:** one interface that answers whether an approved post has been published and when. The live check implements it later; tests use a fake.
- **A jobs runner** over the jobs table, with handlers registered by name ([decision](../decisions/2026-10-08-jobs-table-in-postgres.md)). It is general: the draft check pipeline will use it too.
- **Stages.** A deliverable's money is in one of: not held, held, captured, paid, released, approved not paid, closed as not held. "Confirmed" is not a stage: it is a held deliverable with a go-ahead that has not run out. Waiting on the brand, on Cleared, on a fix or on a capture retry are recorded on the held stage with their own end times.
- **Schema.** One row per deliverable holds its money: the whole state the transition function produces, saved as one document, beside typed columns for what is searched (the stage and the amount) and a version number that goes up with every change. Hold attempts, the capture and the payout live inside that document, not in tables of their own, so the rules and the database cannot drift apart and locking a deliverable is locking one row. Separate tables hold: PayPal calls (purpose, request id, started or settled, PayPal reference), which is also how a webhook's reference finds its deliverable; the money record; PayPal events (for MP-FR-36); and jobs. The row carries the creator's payout email beside the document, never inside it. The terms the document starts from (amount, deadline in days, creator's timezone, when the brand agreed) are supplied when the row is made; the next backend spec decides where they come from.
- **Order of work around a PayPal call:** lock and check the state and record the call as started in one transaction; call PayPal with no transaction open; record the answer, the transition and the next job in a second transaction. A crash between the two leaves a started call for the checker.
- **Configuration:** the fee rate, the amount limits, the go-ahead length, the windows (48 hours, 24 hours, 7 days), the capture retry interval and the job retry limit are named settings with the values in this spec as defaults.
- **Webhook events subscribed:** authorization created and voided; capture completed, denied, pending, refunded and reversed; and the payout item results.
- **A payout PayPal will not send (MP-FR-45)** is a 400, 403 or 422 answer that names an error and is not PayPal pointing at a payout already sent under that id. A rejected log-in, a rate limit, a server error and no answer are not refusals: they stay unknown and are checked.
- **Notices** are entries in the money record addressed to the creator, the brand or both, each with a reason code. Showing or emailing them is the job of the routes and pages built later.

### Requests for William

Decisions in this spec that change, or add to, what his signed specs and built pages show. Nothing in his specs is edited here.

| For | Needs |
| --- | --- |
| Invite (IN-FR-04, IN-FR-08, IN-FR-14) | The creator sees Cleared's fee and what they receive: per post and in total, for example "You receive $1,140.00 after Cleared's 5% fee" ([decision](../decisions/2026-10-08-cleared-fee-and-amount-limits.md)) |
| Invite (IN-FR-05) | It says "Cleared sets no other ceiling". The limits are now $20.00 to $10,000.00; the API refuses others with a reason, which IN-FR-06 already shows |
| Confirm and hold (CH-FR-05) | Whether the brand's terms mention the fee. The brand's hold is unchanged, so this spec does not require it |
| Confirm and hold (CH-FR-18) | An attempt cancelled after 24 hours arrives as `declined`; its reason differs ("PayPal didn't answer in time. Nothing was taken.") |
| Confirm and hold (open item) | A post not held 7 days after agreeing is closed as not held: a new state on both sides' pages |
| Draft check (DC-FR-27) | "Confirmed" lasts only as long as the go-ahead. The card needs the go-ahead's end time, "wait until" and "not confirmed" |
| Draft check (DC-FR-10, DC-FR-29) | More release reasons than `deadline` and `cancelled`: day 28, fix window ended, not accepted, ruled by Cleared, and the brand's hold could not be confirmed |
| Not yet specified | The brand's page after publishing (confirm or object within 48 hours; accept a failed post); cancel on both sides; the creator's payout problems and "send again"; "approved, not paid"; the fix window after a failed live check |

## Testing Decisions

- A good test here states a situation and checks the outcome someone could observe: the stage, the money record, the notices, the jobs scheduled, and exactly which PayPal calls were made. It does not check how the module is arranged inside. Tests are named after the MP-FR or MP-BR they prove.
- **Tooling:** Bun's test runner, against the Docker Postgres, with a fake PayPal behind the port ([decision](../decisions/2026-10-08-backend-test-tooling.md)). The database is real because row locks and transactions are part of what must be proven.
- **Transition function:** every stage and every event, including each refusal and its reason; final stages accept nothing.
- **Money module:** each requirement above as a scenario. In particular: an approval sent twice holds once; a capture with no answer is never started twice; a refused capture is retried and stops at day 28; a payout is never sent while another is in flight; the fee and payout for awkward amounts such as $33.33; cancel refused during a go-ahead and after publishing; the deadline keeping a hold for a post published in time; the go-ahead shortened or deferred near the guarantee's end.
- **The fake PayPal** can decline, answer pending, time out, answer the same request twice and report a payout as unclaimed, failed or returned, each on demand.
- **Jobs runner:** a job written with its money change or not at all; two workers and one due job; retry with a growing delay; marked failed after the limit; due jobs run after a restart.
- **Webhook route:** an unverified event is rejected and logged; a repeated event id changes nothing; an event that would reverse a final stage is ignored.
- **Sandbox suite:** a short set run by hand against the real PayPal sandbox, and before release: hold, go-ahead inside the guarantee, capture, payout, release, and renewing a hold that is more than 3 days old. It is not part of every push.
- There are no earlier backend tests; these are the first. The frontend's tests name themselves after their FR in the same way.

## Out of Scope

- Every brand and creator route, sessions, the link, terms versions and agreeing. The next backend spec.
- The live check and the draft check. Their results are inputs here.
- Emailing or showing notices. This spec records them.
- A screen for Cleared's ruling.
- Getting paid after "approved, not paid", and any second payment flow for the brand.
- Acting on a refund, reversal or dispute after capture (MP-FR-39 records it).
- Currencies other than US dollars, partial captures, and tax.
- Infrastructure as code and deployment. Webhooks need the deployed address; until then the checker covers them.
- CI for the backend.

## Open items

**Added while drafting and accepted by Furqaan at sign-off.** These were not asked in the grill-me session; they are listed so the source of each is clear.

- **MP-FR-13:** a go-ahead is shortened, or deferred to "wait until", when the guarantee is close to ending and PayPal cannot renew it yet.
- **MP-FR-15:** when a go-ahead runs out, the module looks for a published post before ending it, so a brand cannot cancel in the gap between publishing and the live check.
- **MP-FR-21:** for a failure that cannot be fixed, silence from the brand does not pay. This follows the locked rule that a fail never clears on a timer.
- **MP-FR-07:** an attempt cancelled after 24 hours is reported as declined.
- **MP-FR-25:** capture retries run every 6 hours.
- **MP-FR-39:** refunds, reversals and disputes after capture are recorded and not acted on.
- A creator who publishes without a go-ahead is still paid if the capture succeeds. The go-ahead protects the creator; lacking one does not forfeit the payment.

**To verify in the sandbox.**

- From which moment a hold can be renewed, whether it can be renewed more than once, and whether renewing returns a new reference.
- **The $20.00 minimum.** By rough numbers a 5% fee does not cover PayPal's charges below about $50. No real money moves in the sandbox; the limit is a setting.

**Shown by the sandbox.**

- PayPal's server SDK runs on Bun: real calls were made from Bun 1.4.
- Payouts need a United States sandbox business account. An account elsewhere is refused outright, which is what MP-FR-45 now covers.
- A payout to an email with no PayPal account is unclaimed about 15 seconds after it is sent.
- A payout sent again under the same id is refused, and the refusal points at the first one. The port reads that pointer, so a request whose answer was lost finds its payout.
- An unclaimed payout can be cancelled only once PayPal has finished processing it, about 20 seconds after sending, and it then reads as returned.

**Waiting on William.** The fee, the cancel rule, closing unheld posts after 7 days, who decides a payment the live check cannot, and the fix window are shared product behaviour. Furqaan decided them; William can supersede.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with Furqaan: the whole money path as functions, a webhook route and a sandbox script; a 48-hour go-ahead; the deadline releases only when no approved post was published in time; the brand decides a payment the live check cannot, and silence pays; a fix window after a fixable failure; everything undecided is released on day 28; a refused capture is retried to day 28; either side cancels until the go-ahead; a 5% fee from the creator's payout; payout problems are the creator's to fix; unheld posts close after 7 days; stuck attempts are cancelled after 24 hours; $20 to $10,000 per hold; a jobs table in Postgres; PayPal's SDK behind a port; Bun's test runner with real Postgres and a fake PayPal | [Fee and limits](../decisions/2026-10-08-cleared-fee-and-amount-limits.md), [After publishing](../decisions/2026-10-08-what-ends-a-hold-after-publishing.md), [Before publishing](../decisions/2026-10-08-go-ahead-cancel-and-unheld-posts.md), [Jobs table](../decisions/2026-10-08-jobs-table-in-postgres.md), [PayPal client](../decisions/2026-10-08-paypal-client-sdk-behind-port.md), [Backend tests](../decisions/2026-10-08-backend-test-tooling.md) |
| 1.0 | Signed by Furqaan, with the seven items added while drafting accepted as written | none |
| 1.1 | MP-FR-13: when the deadline falls before the guarantee ends, the go-ahead runs to the deadline with no 24-hour margin. Found while building: with a 2-day deadline, a creator asking in the last hours before it was told to wait until after the deadline, and could never publish | [Go-ahead to a deadline inside the guarantee](../decisions/2026-10-08-go-ahead-runs-to-a-deadline-inside-the-guarantee.md) |
| 1.1 | Signed by Furqaan | none |
| 1.2 | MP-FR-24: the first capture re-confirms the hold when its guarantee has ended, as retries already do. Found while building: after a fix window or a brand's 48 hours the guarantee has usually lapsed, and a refused first capture costs the creator a 6-hour wait | [First capture re-confirms a lapsed hold](../decisions/2026-10-08-first-capture-re-confirms-a-lapsed-hold.md) |
| 1.2 | Signed by Furqaan | none |
| 1.3 | MP-FR-45 added: a payout PayPal will not send stays captured, is sent again every 6 hours under the same request id, and is put in front of a person at Cleared. Found against the sandbox: a business account not allowed to send payouts was refused outright, and the rules had no outcome for it, so it would have been checked forever with nobody told | [A payout PayPal will not send](../decisions/2026-10-08-a-payout-paypal-will-not-send.md) |
| 1.3 | Signed by Furqaan | none |
| 1.4 | Schema: a deliverable's money state is stored as one document per deliverable, with PayPal calls, the money record, PayPal events and jobs as tables; hold attempts and payouts no longer have tables of their own. Open items: what the sandbox has shown is recorded, and the two items it settled are removed from "To verify". No requirement changes | [Money state as one document](../decisions/2026-10-08-money-state-as-one-document.md) |
| 1.4 | Signed by Furqaan | none |
