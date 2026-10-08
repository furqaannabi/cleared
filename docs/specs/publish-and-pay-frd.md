# Publish and pay: FRD

**Status:** Signed by William (revision 1.2). The money rules are the money path FRD's (Furqaan's).

**Surface:** Both sides of steps 6 to 8 of [How a deal runs](../PRODUCT.md#how-a-deal-runs). **The creator's side:** the draft check page past "Approved" (DC-FR-51): the go-ahead, "I've posted it", the live check in the checklist, and the money card through captured and paid, including every "not paid yet". **The brand's side:** the Drafts panel and the review page past "Approved" (RW-FR-22): confirming or objecting to a post the live check couldn't decide, accepting a post that failed, and paid.

**Scope of this build:** frontend only, against provisional mocks (see [Mocks and the provisional contract](#mocks-and-the-provisional-contract)). The rules are the [money path FRD](money-path-frd.md)'s (MP, signed by Furqaan) and are not re-decided here: the 48-hour go-ahead (MP-FR-10 to MP-FR-15), what follows publishing (MP-FR-16 to MP-FR-23), capture and payout (MP-FR-24 to MP-FR-31) and release (MP-FR-32). The page starts actions and shows what the API returns. It never decides a money state, works out a fee, or times anything that moves money.

## Problem Statement

A creator with an approved draft needs to know when it is safe to post, because a published video can't be taken back, and then where their money is at every moment until it lands: whether the live post checked out, what's missing if it didn't and until when it can be fixed, and why a payment hasn't arrived. "Processing" with no reason is the problem Cleared exists to fix.

The brand needs to know when its money is taken and for what, and to make the two decisions only it can make after publishing: whether a post the live check couldn't judge is fine, and whether to pay for a post that failed anyway.

## Solution

On the creator's page, after "Approved", the next step is "Get the go-ahead". Cleared asks PayPal to confirm the brand's hold and answers: post now, before a stated time (with a countdown); wait until a stated time; or don't post, because the hold couldn't be confirmed. Once posted, the creator taps "I've posted it" (a Reel also gives its link). The live check judges the "At live check" items in the same checklist, each with evidence from the live post, and a banner says what it found: passed; something the creator can still fix, with "Check again" until a stated time; something that can't be fixed, which the brand may accept; or a post it couldn't judge, which the brand confirms (silence pays). The money card follows captured, then paid, with the fee and each PayPal reference, and says plainly what to do when a payout is unclaimed or bounced.

On the brand's side, the Drafts panel and the review page carry on: "Confirm the post" or "Object" when the check couldn't decide, "Accept the post anyway" when it failed, a note while a person at Cleared decides, and "Paid" with what was taken. Each 48-hour decision says what silence does, because the two point in opposite directions.

Cancelling is not in this spec; it gets its own.

## User Stories

**The creator**

1. As a creator with an approved draft, I want to ask for the go-ahead when I'm ready, so that the 48 hours start when I'm about to post.
2. As a creator, I want to be told plainly that I can post and before when, so that I never publish without a confirmed hold.
3. As a creator, I want a countdown to the end of my go-ahead, in my own time, so that I don't miss it.
4. As a creator told to wait, I want to know until when and why, so that I ask again at the right time.
5. As a creator whose brand's hold couldn't be confirmed, I want to be told not to post and that the brand was told, so that I don't publish for free.
6. As a creator whose go-ahead ran out before I posted, I want to be able to ask again, so that a busy day doesn't cost me the deal.
7. As a creator who posted on YouTube, I want one tap to tell Cleared, so that the live check starts.
8. As a creator who posted a Reel, I want to paste its link, so that Cleared checks the right post.
9. As a creator, I want to know that the live check still runs if I forget to tap, so that I'm not penalised.
10. As a creator, I want each "At live check" item to show its result and evidence from the live post, so that I see what was checked.
11. As a creator whose post failed on something I can still fix, I want to know what, until when, and to check again, so that a missing link doesn't cost me the payment.
12. As a creator whose post failed on something I can't fix, I want to know the brand can still accept it and by when, so that I know where I stand.
13. As a creator whose post the check couldn't judge, I want to know the brand has 48 hours and that silence pays me, so that I'm not anxious.
14. As a creator whose brand objected to the live post, I want to know a person at Cleared decides and by when.
15. As a creator, I want to see when the money was captured, with its PayPal reference, and what I'll receive after the fee.
16. As a creator, I want to see when I was paid, with the PayPal reference, so that I can find it in PayPal.
17. As a creator whose payout is unclaimed, I want to be told to accept it in PayPal at the email it went to, and to send it again if needed.
18. As a creator whose payout bounced, I want to correct my PayPal email and send it again from the same place.
19. As a creator whose brand's payment failed at capture, I want to know Cleared keeps trying and until when.
20. As a creator whose post ended "approved, not paid", I want that said plainly, so that I know Cleared can't collect it.
21. As a creator whose hold went back to the brand, I want the reason in plain words, so that I understand what happened.
22. As a creator, I want the deal steps and the rail to say where each post is, through to Paid.

**The brand**

23. As a brand, I want the Drafts panel to say where each post is after approval: posting, live, waiting on me, paid.
24. As a brand, I want to see the live post, so that I can judge it myself.
25. As a brand whose post the check couldn't judge, I want to see why, confirm it, or object with a reason, before a stated time.
26. As a brand, I want to be told that saying nothing pays the creator, so that silence is a choice.
27. As a brand, I want confirming to say my money is taken, so that I confirm knowingly.
28. As a brand whose post failed, I want to accept it anyway or let the hold come back to me, knowing that silence returns my money.
29. As a brand who objected, I want to know a person at Cleared decides and by when.
30. As a brand, I want to see that my money was taken, how much, and the PayPal reference.
31. As a brand whose hold came back, I want to know why and when.

**Both**

32. As a creator or brand on a phone, I want these states to work at 375 px with 44 px targets.
33. As a keyboard or screen-reader user, I want every control named and every state change and countdown milestone announced politely.
34. As someone demoing on mock data, I want to choose each outcome, so that every state can be shown.

## Functional requirements

### The go-ahead (creator)

| ID | Requirement |
| --- | --- |
| PP-FR-01 | **Get the go-ahead.** At "Approved" (DC-FR-51), the next step's action is "Get the go-ahead", with "Ask when you're about to post. It lasts up to 48 hours." While the API answers: "Checking {brand}'s hold with PayPal…", the action off. |
| PP-FR-02 | **Go-ahead.** "You can post now. Post before {time}" with the viewer's own time as DC-FR-44, a countdown that moves from the API's end time, and the action "I've posted it". The money card shows Confirmed (DC-FR-27). The page shows only the end time the API gives. |
| PP-FR-03 | **Wait until.** "PayPal can renew {brand}'s hold from {time}. Ask again then." The action stays, off until that time. |
| PP-FR-04 | **Not confirmed.** "PayPal couldn't confirm {brand}'s hold, so don't post yet. We've told {brand} to check their PayPal. You can ask again." The action is "Ask again". |
| PP-FR-05 | **A go-ahead that ran out.** When the API reports the go-ahead ended with no post: "Your go-ahead ended before you posted. Ask again when you're ready." The action is "Get the go-ahead". |

### Posting (creator)

| ID | Requirement |
| --- | --- |
| PP-FR-06 | **I've posted it: YouTube.** Opens an inline confirmation: "Is the video public on your channel? We check it's the same video you uploaded as unlisted." with "Yes, it's public" and "Not yet". |
| PP-FR-07 | **I've posted it: Instagram.** Opens an inline field "Your Reel's link" (an `https://www.instagram.com/reel/…` or `/p/…` link, checked for that shape before sending; the API decides whether it's on the creator's account) and "Check my Reel". A refused link: "That Reel isn't on {account}'s account. Check the link." or the API's reason. |
| PP-FR-08 | **If they forget.** The go-ahead line says "If you forget to tap, we check your {platform} when your go-ahead ends." |

### The live check (creator)

| ID | Requirement |
| --- | --- |
| PP-FR-09 | **Checking.** After posting: a banner "Checking your live post…", the "At live check" items show Checking (DC-FR-13), and "View your post" links to it. |
| PP-FR-10 | **Results in the checklist.** Each "At live check" item takes its live result: Passed or Fix needed, with evidence from the live post ("Description has juniperandsalt.com/ada"), as DC-FR-12. Items judged at the draft check keep their draft results. |
| PP-FR-11 | **Passed.** Banner: "Your live post checked out." The money card moves on (PP-FR-17). |
| PP-FR-12 | **Fixable.** Banner: "{n} items to fix on your live post. Fix them and check again before {time}." with "Check again". The failing items are selected first and say what's missing. If the window ends, the release shows (PP-FR-22). |
| PP-FR-13 | **Not fixable.** Banner: "Your live post doesn't match the approved draft." (or the API's reason) and "{brand} has until {time} to accept it anyway. If they don't, the hold goes back to them." No action for the creator. |
| PP-FR-14 | **Couldn't decide.** Banner: "We couldn't check {what} automatically." and "{brand} has until {time} to confirm. If they say nothing, you're paid. If they object, a person at Cleared decides." |
| PP-FR-15 | **Objected after posting.** "{brand} objected to the live post: “{reason}”. A person at Cleared decides by {date}." |

### Money (creator)

| ID | Requirement |
| --- | --- |
| PP-FR-16 | **The money card's stages.** Held → Confirmed → Captured → Paid, each with its PayPal reference when the API sends one (DC-FR-27). Amounts and the fee are the API's; the page never works them out. |
| PP-FR-17 | **Captured.** "Captured · {amount} · PayPal ref {ref}" and "Sending {payout} to {email} ({amount} less Cleared's 5% fee of {fee})." |
| PP-FR-18 | **Paid.** "Paid · {payout} · PayPal ref {ref}", the date, and a cleared seal. The deal steps all show done; the next step says "Cleared. Nothing more to do on this post." |
| PP-FR-19 | **Unclaimed.** "PayPal is holding {payout} for {email}. Accept it in PayPal with that email." When the API allows it, "Send it again" (the API cancels the unclaimed one first, MP-FR-30). |
| PP-FR-20 | **Failed or returned.** "{payout} couldn't be paid to {email}." and the API's reason in plain words, then "Correct your PayPal email" in place (as IN-FR-12, saved to the profile) and "Send it again". Offered only when the API allows it. |
| PP-FR-21 | **Capture refused.** "Approved. PayPal couldn't take {brand}'s payment yet. We try again until {date} and have told {brand}." No action. At the end without success: "Approved, not paid" (PP-FR-23). |
| PP-FR-22 | **Released, every reason.** The released state (DC-FR-10, DC-FR-29) names the reason in plain words: the deadline passed with no approved post; cancelled (and by whom); day 28; the fix window ended with {items} still failing; {brand} didn't accept the post within 48 hours; a person at Cleared ruled not to pay; {brand}'s hold couldn't be confirmed before the deadline. With the date, and that nothing more can happen. |
| PP-FR-23 | **Approved, not paid.** "This post was approved, but PayPal never let Cleared collect {brand}'s payment, so you weren't paid through Cleared." Final; no action. |
| PP-FR-35 | **Payout delayed on Cleared's side** (MP-FR-45). The Paid step is current, not a problem: "Sending {payout} to {email} is delayed", then "The delay is on Cleared's side, with our PayPal account. Your money is safe with Cleared, and we keep trying until it's sent. There's nothing you need to do." No action (MP-FR-30) and no time for the next try. The heading stays "Captured from {brand}". |
| PP-FR-36 | **Sending again after an unclaimed payout** (MP-FR-30). While PayPal cancels the unclaimed payout: the Paid step is current, "Sending {payout} again", then "PayPal is cancelling the unclaimed payment first, then we send it to {email}." No action; the page keeps checking as it does while sending. |
| PP-FR-24 | **Steps and the rail.** The deal steps mark Publish, Live check and Paid from the API's state (DC-FR-34). Rail lines: "Post before {time}", "Live check", "{brand} to confirm", "Paid", "Payout needs you", among others. "Payout needs you" only for an unclaimed or failed payout; a delayed or cancelling one keeps the captured line (PP-FR-35, PP-FR-36). |

### The brand

| ID | Requirement |
| --- | --- |
| PP-FR-25 | **Drafts lines.** RW-FR-01's lines continue: "{creator} has the go-ahead · posts by {date}"; "Posted · checking the live post"; "Confirm the post · {time left}" and "Review post" (needs the brand); "Accept the post? · {time left}" and "Review post" (needs the brand); "A person at Cleared is deciding"; "Paid · {amount} taken"; "Approved, not paid"; and the release reason. Posts that need the brand come first (RW-FR-02). |
| PP-FR-26 | **The live post.** Once posted, the review page shows "View the live post" (opening the platform in a new tab) and each "At live check" item's live result. |
| PP-FR-27 | **Confirm or object.** When the check couldn't decide: why ("We couldn't check {what} automatically"), "If you say nothing by {time}, {creator} is paid.", "Confirm the post" (inline confirmation: "Confirm? Your {amount} is taken and {creator} is paid.") and "Object" (a reason, required, plain text up to 500 characters; "A person at Cleared will decide. Your money stays held until then."). |
| PP-FR-28 | **Accept anyway.** When the post failed and can't be fixed: what failed, "If you don't accept it by {time}, the hold comes back to you.", and "Accept the post anyway" (inline confirmation: "Accept? Your {amount} is taken and {creator} is paid."). |
| PP-FR-29 | **With Cleared.** "You objected: “{reason}”. A person at Cleared decides by {date}. Your money stays held until then." |
| PP-FR-30 | **Taken and paid.** "Your {amount} was taken on {date} · PayPal ref {ref}", then "{creator} was paid." The brand never sees the creator's payout email or the payout's own problems; while a payout is unsettled the brand reads "Your {amount} was taken. {creator}'s payment is on its way.", including while it is delayed or being sent again (PP-FR-35, PP-FR-36). |
| PP-FR-31 | **Released, for the brand.** "Your {amount} came back to you on {date}" and the reason from the brand's side. A capture PayPal refused: "Your payment for this post failed at PayPal. Check your PayPal funding; we try again until {date}." |

### Mocks, responsive and accessibility

| ID | Requirement |
| --- | --- |
| PP-FR-32 | **Demo controls (mock builds only),** each a dashed "Demo (mocks only)" box supplied only by the mock gate, never in a real build: the go-ahead's answer (go-ahead, wait until, not confirmed); the live check's result (passed, fixable, not fixable, couldn't decide); the payout's result (paid, unclaimed, failed, won't send), with "Try the payout again now" while one is delayed; the mock tries a delayed payout again every 6 hours with the outcome selected then, and shows an unclaimed payout being cancelled for about 3 seconds after "Send it again"; "End the 48 hours now" on the brand's decisions. The seed gains a paid post with every reference. |
| PP-FR-33 | Mobile-first at 375 px: banners and the money card in the DC-FR-47 order, every target at least 44 px, the creator's action in the phone bar (DC-FR-30), the brand's in its dock (RW-FR-29), no sideways scroll. |
| PP-FR-34 | Every control named ("Confirm the post", "Check my Reel"); state changes announced politely; a countdown announced only when it crosses the last hour; reduced motion respected (the paid seal stamps only with motion allowed). |

## Business rules

| ID | Rule |
| --- | --- |
| PP-BR-01 | The page shows the money state the API reports and decides none. It never says "post now" without a go-ahead from the API, and the go-ahead's end time is the API's. |
| PP-BR-02 | Silence is stated every time a brand decision is due: couldn't decide, silence pays; failed, silence returns the money (MP-FR-18, MP-FR-21). |
| PP-BR-03 | Objection reasons are untrusted plain text: shown as text, never as markup, never acted on, never logged (MP-BR-13). |
| PP-BR-04 | The creator's PayPal email and payout problems are shown only to the creator (IN-BR-05). |
| PP-BR-05 | A post link is shown as a link only when it is `https` on the platform's own domain (youtube.com, youtu.be, instagram.com); otherwise as plain text. |
| PP-BR-06 | "Send it again" and "Check again" appear only when the API offers them; the page never sends a second payout or check while one is in flight. |
| PP-BR-07 | Fees and payouts are the API's figures, decimal strings or minor units, never computed on the page. |

## Implementation Decisions

- **Creator side:** the draft check page gains its later states, from one deliverable view (the DC view model extended): go-ahead, posted, live result, money. The money card gains captured, paid and the payout problems. New banners sit where the passed and approved banners do.
- **Brand side:** the brand review view and `postLines` gain the later states; the review page's "Your review" carries the brand's decision.
- **Modules:** pure and tested on their own: the creator's later-state view (banner, next step, action, countdown), the money card's lines for every stage and problem, the release reason in words for each side, and the brand's later-state view.
- **Data:** the provisional schemas and typed client gain the calls below. Mocks extend the store's deliverable and the brand's projection, with mock-only endpoints for the demo outcomes.
- **Visual:** inherits DESIGN.md, the draft check and the brand review. Mockups in `design/publish-and-pay/` before build, at 390 px and desktop; William picks.

## Mocks and the provisional contract

```ts
// Provisional. Added to the creator's deliverable (DC).
state: …existing | "posting" | "published" | "captured" | "paid" | "approved_not_paid";
goAhead?:
  | { state: "go"; endsAt: string }
  | { state: "wait"; until: string }
  | { state: "not_confirmed" }
  | { state: "ended" };
post?: { url?: string; publishedAt: string };
liveCheck?:
  | { state: "checking" }
  | { state: "passed" }
  | { state: "fixable"; fixBy: string }
  | { state: "not_fixable"; reason: string; brandBy: string }
  | { state: "undecided"; what: string; brandBy: string }
  | { state: "objected"; reason: string; ruleBy: string };
capture?: { reference: string; at: string; amount: string; fee: string; payout: string }
  | { refused: true; retryUntil: string };
// "delayed" is the money view's not_sent (MP-FR-45), "cancelling" its cancelling (MP-FR-30); both with canSendAgain: false.
payout?: { state: "sending" | "cancelling" | "delayed" | "unclaimed" | "failed" | "paid"; email: string; reason?: string; reference?: string; at?: string; canSendAgain: boolean };
releaseReason: "deadline" | "cancelled" | "day_28" | "fix_window_ended" | "not_accepted" | "ruled_not_to_pay" | "hold_not_confirmed";

// The brand's review (RW) gains:
review: …existing | { state: "posting"; postBy: string } | { state: "live_check" }
  | { state: "confirm"; endsAt: string; what: string } | { state: "accept"; endsAt: string; reason: string }
  | { state: "with_cleared"; reason: string; ruleBy: string }
  | { state: "taken"; amount: string; reference: string; at: string; creatorPaid: boolean }
  | { state: "approved_not_paid" } | { state: "capture_refused"; retryUntil: string };
post?: { url: string };
```

### Requests for Furqaan

Each maps to a function his money module already has (MP "Implementation Decisions"); the routes are new.

| For | Needs |
| --- | --- |
| PP-FR-01 to PP-FR-05 | `POST /deliverables/{id}/go-ahead`: asks for the go-ahead (MP-FR-10); answers go, wait or not confirmed; `goAhead.state: "ended"` when one ran out (MP-FR-15) |
| PP-FR-06 to PP-FR-08 | `POST /deliverables/{id}/posted` with `{ url? }` (required for a Reel): records the post and starts the live check (MP-FR-16); refuses a Reel not on the creator's account, with a reason |
| PP-FR-10 to PP-FR-15 | The live check's result per item and overall, with evidence from the live post and the fix-window, brand and ruling end times (MP-FR-17 to MP-FR-21) |
| PP-FR-12 | `POST /deliverables/{id}/live-check/again`, within the fix window |
| PP-FR-16 to PP-FR-23 | Capture and payout fields as above, the fee and payout as decimal strings (MP-FR-24 to MP-FR-31) |
| PP-FR-35, PP-FR-36 | The payout's `delayed` and `cancelling` states, from the money view's `not_sent` (reason `payout_delayed`) and `cancelling` (reason `payout_being_cancelled`) |
| PP-FR-19, PP-FR-20 | `POST /deliverables/{id}/payout/again` (MP-FR-30); `PUT /me/paypal-email` (IN-FR-12) |
| PP-FR-22, PP-FR-31 | `releaseReason` with every reason in MP-FR-32, and `cancelledBy` |
| PP-FR-25 to PP-FR-31 | `GET /brand/deals/{id}/deliverables/{id}` and the Drafts summary gain the states above, never the creator's payout email; `POST …/post/confirm`, `POST …/post/object` with `{ reason }` (≤ 500, plain text), `POST …/post/accept` |
| Mocks only | `POST /__demo/go-ahead/next`, `/__demo/live-check/next`, `/__demo/payout/next` with `{ outcome }` (now also `wont_send`), `/__demo/payout/{deliverableId}/try-again`, and `/__demo/brand/{deliverableId}/end-48h`. MSW only, never part of the real API |
| Security | Every changing request protected from cross-site requests, as DC's |

## Testing Decisions

- Tests check what each side sees and can do, named after the PP-FR they prove.
- **Views (pure):** every later state's banner, next step and action; the countdown and its last hour; every release reason on each side; the money lines for captured, paid, delayed, cancelling, unclaimed, failed, capture refused, approved not paid; never "post now" without a go-ahead; the brand never sees the payout email.
- **Components:** the go-ahead's three answers and the run-out; "I've posted it" for YouTube and a Reel (link shape, refusal); fixable with Check again; the brand's confirm and object (reason required) and accept, each with its confirmation and silence line; the money card's problems with Send it again and the email fix; the demo controls only in mock builds.
- **End to end (Playwright, on MSW):** an approved post → go-ahead → I've posted it → couldn't decide → the brand confirms → captured → paid, on both sides; and fixable → check again → passed; at 375 px and 1280 px.

## Out of Scope

- Cancelling a deal or a post (its own spec next).
- The real live check, re-confirmation, capture and payout (the backend's), and a screen for Cleared's ruling (MP).
- Emailing notices; refunds, reversals and disputes after capture.
- Payouts and Connected accounts pages.

## Open items

- **The 5% fee on the invite** (MP's Requests for William) is not in this spec.
- **What the live check can't decide**, in words, comes from the API (`what`); the mock uses Instagram's paid-partnership label (PRODUCT.md "Platforms").

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: one spec for both sides; "I've posted it" with a Reel's link, and a check at the go-ahead's end; the go-ahead asked for when ready; live results in the same checklist with a summary banner; every money stage and payout problem on the money card; the brand's decisions after publishing on the review page, with both silence rules stated; every release reason; demo controls for each outcome. Follows the money path FRD's rules | [Go-ahead and cancel](../decisions/2026-10-08-go-ahead-cancel-and-unheld-posts.md), [After publishing](../decisions/2026-10-08-what-ends-a-hold-after-publishing.md), [Fee and limits](../decisions/2026-10-08-cleared-fee-and-amount-limits.md) |
| 1.0 | Signed by William | none |
| 1.1 | PP-FR-35 and PP-FR-36 added, from a grill-me session with William: a payout PayPal won't send shows as delayed on Cleared's side with nothing for the creator to do, and an unclaimed payout being cancelled shows as sending again. Neither changes the deals list or the brand's view. PP-FR-24, PP-FR-30 and PP-FR-32 and the contract follow. Shows MP-FR-45 and MP-FR-30 (money path 1.3). Signed by William | none |
| 1.2 | Pointer: cancelling (Out of Scope here, "its own spec next") is specified in the [cancel FRD](cancel-frd.md); the released reason "cancelled (and by whom)" in PP-FR-22 and PP-FR-31 follows CN-FR-10. No requirement changes here | none |
| 1.2 signed | Revision 1.2 signed by William | none |
