# Cancel: FRD

**Status:** Signed by William (revision 1.1). The cancel rules are the money path FRD's (Furqaan's).

**Surface:** Both sides, from the invite until the go-ahead. **The creator's side:** "Cancel this post" on the draft check page (`/deals/{id}/deliverables/{id}`) and on each post's line on the invite page (`/deals/{id}/invite`), and "Cancel the deal" on the invite page. **The brand's side:** "Cancel this post" on the review page (`/brand/deals/{id}/deliverables/{id}`) and on each post's line on the deal page (`/brand/deals/{id}`), and "Cancel the deal" on the deal page. After a cancel, both sides see the post as cancelled: released, or closed if nothing was held.

**Scope of this build:** frontend only, against provisional mocks. The rules are the [money path FRD](money-path-frd.md)'s (MP, signed by Furqaan): either side can cancel while there is no go-ahead and nothing is published (MP-FR-33); a held post's hold is released (MP-FR-32); a post not yet held is closed, and a hold attempt waiting at PayPal is stopped there first (MP-FR-34). The page asks; the API decides and says why when it refuses. The one thing the money path doesn't have yet, the note to the other side, is a [request for Furqaan](#requests-for-furqaan).

## Problem Statement

A deal can stop before anything is delivered: the brand pauses its campaign, the creator can't make a post, the invite went to the wrong brand, the terms never get agreed. PRODUCT.md says a cancelled deal releases the hold and the [go-ahead and cancel decision](../decisions/2026-10-08-go-ahead-cancel-and-unheld-posts.md) says who can cancel and until when, but no page offers it. Without it, the brand's money stays held until the deadline or day 28, and the creator has no clean way to say "this post isn't happening". Neither side can walk away, and neither is told why the other did.

## Solution

Each post has a quiet "Cancel this post" while it can be cancelled, on both sides; the deal has "Cancel the deal", which cancels every post that still can. Tapping it opens an inline confirmation (a full-screen sheet on phones) saying plainly what happens to the money, with an optional note for the other side. Once cancelled, a held post shows as released, with who cancelled, when and their note; a post that was never held shows as closed, with nothing taken. Where a cancel isn't possible (a go-ahead is running, the post is published, it was already cancelled), the button is replaced by one line saying why. Cancels are final.

## User Stories

1. As a creator, I want to cancel a post I'm not going to make, so that the brand gets its money back early.
2. As a brand, I want to cancel a post before the creator is cleared to publish, so that I can walk away while nothing is lost.
3. As either side with several posts in a deal, I want to cancel the whole deal at once, so that I don't have to cancel each post.
4. As either side cancelling the whole deal, I want to be told which posts couldn't be cancelled and why, so that I know what's still running.
5. As either side, I want to be told exactly what happens to the money before I confirm, so that I don't cancel by mistake.
6. As either side, I want the cancel to be quiet on the page, not a big button, so that I don't tap it while doing something else.
7. As either side, I want to add a short note saying why, so that the other side isn't left guessing.
8. As either side, I want the note to be optional, so that I can cancel without writing an explanation.
9. As the other side, I want to see who cancelled, when and their note, so that I understand what happened.
10. As a brand, I want to see that my money came back and when, so that I know it's no longer held.
11. As a creator, I want to see that the post was cancelled and nothing more can happen, so that I stop working on it.
12. As either side, I want a post cancelled before it was held to say nothing was taken, so that I'm not worried about money.
13. As a creator who sent an invite to the wrong brand, I want to cancel the deal from the invite page, so that the link stops working.
14. As a brand who changed its mind before agreeing, I want to cancel the deal, so that I don't have to leave it hanging.
15. As a brand whose hold is waiting at PayPal, I want cancelling to stop that too, so that nothing is taken later.
16. As a creator with the go-ahead, I want the brand unable to cancel, so that the money can't be pulled while I post.
17. As either side when a cancel isn't possible, I want one plain line saying why, so that I'm not looking for a button that isn't there.
18. As either side whose cancel lost a race (the other side cancelled first, or the go-ahead started), I want to be told what happened, so that the page doesn't just fail.
19. As either side, I want the deals list to show cancelled posts and deals plainly, so that they don't look like work in progress.
20. As either side, I want a fully cancelled deal to sink to the bottom of my list, so that live deals stay on top.
21. As either side on a phone, I want the confirmation full-screen with large targets, so that I can read it and choose clearly.
22. As a screen reader user, I want the cancel controls named and the outcome announced, so that I know it worked.
23. As William demoing on mocks, I want to cancel from the existing seeded deals and reset afterwards, so that I can show every case without new data.

## Requirements

### Where cancel is offered

| ID | Requirement |
| --- | --- |
| CN-FR-01 | **Cancel this post.** A quiet text button (espresso, underlined, at least 44 px tall; never a pill) labelled "Cancel this post". Creator: under the money card, or under the journey once approved (PP), on the draft check page; and on each post's line on the invite page while that post isn't held. Brand: under the hold panel on the review page, and on each post's line on the deal page. |
| CN-FR-02 | **Cancel the deal.** The same quiet button, "Cancel the deal", at the bottom of the creator's invite page and the brand's deal page, shown while at least one post can be cancelled. It cancels each post that can be cancelled, one request each (MP-FR-33, MP-FR-34). |
| CN-FR-03 | **Only when the API allows it.** Each post's `cancel` field says whether it can be cancelled now and, if not, why. The page shows the button only when it can. When it can't, and the post isn't finished, one line in ink-3 takes its place: "You can't cancel now: you have the go-ahead to post." / "{creator} has the go-ahead to post." (go-ahead running); "You can't cancel now: this post is published." (published). A post already released, closed or paid shows nothing. |

### Confirming

| ID | Requirement |
| --- | --- |
| CN-FR-04 | **Inline confirmation.** Tapping the button opens a confirmation in place (a full-screen sheet on phones, inline in the panel from `md:`): a heading "Cancel this post?" or "Cancel the deal?", what happens to the money, the note, and two actions, "Cancel the post" / "Cancel the deal" (fail colour) and "Keep it". Focus moves to the heading; Escape and "Keep it" close it and return focus to the button. |
| CN-FR-05 | **What happens to the money.** Held: "{brand}'s {amount} hold goes back to them. This can't be undone." (creator) or "Your {amount} comes back to you. This can't be undone." (brand). Not held: "Nothing is held yet. The post closes. This can't be undone." With a hold attempt waiting at PayPal, it adds "We'll also stop the hold waiting at PayPal." Amounts are the API's. |
| CN-FR-06 | **The deal's confirmation** lists each post with what will happen to it: "Cancelled · {amount} back to {brand}", "Closed · nothing held", or "Stays · {reason}" for a post that can't be cancelled. If none can, there is no button (CN-FR-02). |
| CN-FR-07 | **The note.** "Add a note for {other side} (optional)", plain text, up to 300 characters with a live count. Sent with the cancel and shown to the other side as plain text (never as markup or a link). One note for the whole deal when cancelling the deal. |
| CN-FR-08 | **Sending.** While sending, the confirm button shows "Cancelling…" and both actions are disabled. On success the page shows the cancelled state (CN-FR-09 to CN-FR-12) and announces "Cancelled." politely. A network failure keeps the confirmation open with "That didn't go through. Try again." and the note kept. |
| CN-FR-09 | **A lost race.** If the API refuses because things changed, the confirmation is replaced by the reason and the page reloads the post: "You can't cancel now: {creator} has the go-ahead to post."; "… this post is published."; "This post was already cancelled by {who}." The note is dropped. For the deal, each post's outcome is listed: cancelled, or stays with its reason. |

### After a cancel

| ID | Requirement |
| --- | --- |
| CN-FR-10 | **A held post, cancelled.** The released state (DC-FR-10, DC-FR-29; RW-FR-01's released line; PP-FR-22, PP-FR-31) with the reason in full. Creator: "You cancelled this post on {date}." or "{brand} cancelled this post on {date}." Brand: "Your {amount} came back to you on {date}. You cancelled this post." or "… {creator} cancelled this post." The other side's note follows in quotes when there is one. Drafted asks or objections on the post are dropped, and nothing more can be done on it. |
| CN-FR-11 | **A post not held, cancelled: Closed.** A new closed state on both sides, styled as released (latte, no lift, no amount moving): "Cancelled before it was held. Nothing was taken." with who, when and the note as in CN-FR-10. Its line on the invite page and the brand's deal page reads "Cancelled · nothing held". |
| CN-FR-12 | **Lines and the deals list.** A cancelled post's line on either side reads "Cancelled". A deal with every post cancelled or closed shows "Cancelled" in the deals list and sits at the bottom; a deal with some posts cancelled follows its remaining posts. |
| CN-FR-13 | **Final.** Nothing reopens a cancelled post or deal. |

### Before the brand agrees

| ID | Requirement |
| --- | --- |
| CN-FR-14 | **The creator cancels the invite.** "Cancel the deal" on the invite page closes every post. The brand's invite link then stops working and shows CH-FR-02's page, which names no one and gives no reason, as it does for any link that doesn't work. |
| CN-FR-15 | **The brand cancels before agreeing.** "Cancel the deal" on the brand's deal page, beside asking for changes. The creator sees the deal as Cancelled, with the brand's note. A brand with a session for the deal who opens it again sees it cancelled, with who cancelled and when. |

### Mocks, responsive and accessibility

| ID | Requirement |
| --- | --- |
| CN-FR-16 | **Mocks.** No new seed and no demo control: Pine & Co (invite), Maple & Moss (waiting for the brand), Kora Audio (held, no draft) and the Juniper video and Reel (in review) can be cancelled; the Juniper Short once it has the go-ahead, and Wren Coffee (paid), show why they can't. "Reset demo data" restores them. The other side is seen through the brand link in the same browser. |
| CN-FR-17 | Mobile-first at 375 px: the sheet full-screen with the actions at the bottom, every target at least 44 px, no sideways scroll. |
| CN-FR-18 | Every control named ("Cancel this post", "Cancel the deal", "Keep it"); the note labelled; the outcome announced politely; reduced motion respected. |

## Business rules

| ID | Rule |
| --- | --- |
| CN-BR-01 | The page never decides whether a post can be cancelled; it follows the API's `cancel` field and shows the API's refusal (MP-FR-33). |
| CN-BR-02 | One cancel request per post. "Cancel the deal" sends them one at a time and reports each outcome; a failure on one doesn't undo the others. |
| CN-BR-03 | A cancel is never retried by the page on its own; a failed request is retried only when the person taps again. |
| CN-BR-04 | The note is untrusted plain text: validated (≤ 300 characters after trimming), rendered as text, never logged. |
| CN-BR-05 | Amounts shown are the API's; the page works none out. |

## Implementation Decisions

- **One cancel view (pure):** from a deliverable and the viewer's side, it returns whether to show the button, the why-line, the confirmation's money sentence, and the cancelled state's wording. The deal's version maps each post to cancelled, closed or stays. Both sides use it.
- **Components:** a cancel button with its confirmation (inline from `md:`, sheet on phones), used on the four pages; the closed state beside the existing released state. Each under ~200 lines.
- **API client:** `cancelDeliverable(id, note?)` for the creator; `cancelBrandDeliverable(dealId, id, note?)` for the brand. "Cancel the deal" calls these per post.
- **Mocks:** cancel handlers that apply MP-FR-33 and MP-FR-34 (refused during a go-ahead or once published; held → released with reason cancelled; not held → closed), store `cancelledBy`, `cancelledAt` and the note, and make the deal's invite link stop working once every post is closed or released.

### The contract (provisional)

```ts
// Each deliverable, on both sides, gains:
cancel:
  | { allowed: true; holdAttemptWaiting?: boolean }
  | { allowed: false; reason: "go_ahead_running" | "published" | "finished" };
state: …existing | "closed";                       // CN-FR-11
releaseReason: …existing;                          // "cancelled" already exists
cancelled?: { by: "creator" | "brand"; at: string; note?: string }; // CN-FR-10, CN-FR-11

// Requests
POST /deliverables/{id}/cancel                     { note?: string }   // creator
POST /brand/deals/{dealId}/deliverables/{id}/cancel { note?: string }  // brand
// 1.1: from the pages that list a deal's posts, held or not (a post not held has no draft check page):
POST /deals/{dealId}/invite/posts/{id}/cancel     { note?: string }   // creator; answers with the invite
POST /brand/deals/{dealId}/posts/{id}/cancel      { note?: string }   // brand; answers with the deal
// Refusals: 409 with { reason: "go_ahead_running" | "published" | "already_cancelled", by? }
```

### Requests for Furqaan

| For | Needs |
| --- | --- |
| CN-FR-01, CN-FR-03 | `cancel` on each deliverable from the money view: allowed now, or why not (`go_ahead_running`, `published`, `finished`), and whether a hold attempt is waiting at PayPal (MP-FR-33, MP-FR-34) |
| CN-FR-04, CN-FR-09 | The two cancel routes above, each checking the caller is a party to the deal; refusals with the reason and, for an earlier cancel, who |
| CN-FR-01, CN-FR-02, CN-FR-14, CN-FR-15 | **1.1:** the invite page's and the brand deal page's cancel routes above, for any post of the deal, held or not, each answering with that page's data; each post in the invite and the brand's deal carries `cancel` and `cancelled` |
| CN-FR-07 | **New:** an optional `note` on the cancel (≤ 300 characters, plain text), stored with the cancel and returned to both sides. The money module records who cancels but not a note today |
| CN-FR-10, CN-FR-11 | `cancelled: { by, at, note? }` on both sides' deliverable; a `closed` state for a post cancelled before it was held (the money view's `closed_not_held` with reason `cancelled`) |
| CN-FR-12 | The deals list and the brand's deal summary showing cancelled posts and a fully cancelled deal |
| CN-FR-14 | The invite link stops working once every post in the deal is closed or released, with CH-FR-02's single response |
| Security | Every changing request protected from cross-site requests, as DC's |

## Testing Decisions

- Tests check what each side sees and can do, named after the CN-FR they prove.
- **View (pure):** the button or the why-line for every state on each side; the money sentence held, not held, with an attempt waiting; the cancelled wording by each side with and without a note; the deal's list of outcomes.
- **Mock API:** refused during a go-ahead and once published; held → released with reason cancelled and who; not held → closed; a waiting attempt stopped; the note stored and capped; an invite link refused once the deal is fully cancelled; the brand never sees the creator's PayPal email.
- **Components:** the confirmation inline and as a sheet, the note's count, Cancelling…, Keep it returning focus, a lost race showing its reason, the closed state.
- **End to end (Playwright, on MSW):** the brand cancels the Juniper Reel → the creator sees "Juniper & Salt cancelled this post" with the note; the creator cancels Pine & Co's invite → the link shows CH-FR-02's page; the Short with a go-ahead shows why it can't be cancelled; at 375 px and 1280 px.

## Out of Scope

- Deleting a deal before its invite is sent (before the brief is read, the posts page can still change it, BC-FR-23).
- Posts closed as not held after 7 days, and hold attempts cancelled after 24 hours (MP-FR-07, MP-FR-08): their own revision next.
- Emailing the other side about a cancel.
- Reopening or undoing a cancel; refunds after capture.

## Open items

- **The note (CN-FR-07) is new backend behaviour.** Until Furqaan adds it, a real build sends the cancel without a note and the other side sees only who cancelled and when.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: each post can be cancelled, with "Cancel the deal" cancelling every post it can; an optional note for the other side; a quiet button with an inline confirmation (a sheet on phones) and a why-line when it can't be cancelled; a cancelled held post shows as released with who, when and the note, and a post not held as closed; cancelled lines in both lists; cancelling before the brand agrees, with the invite link then showing CH-FR-02's page; lost races explained; the existing seeds, no demo control. Follows the money path FRD's MP-FR-32 to MP-FR-34 | [Go-ahead and cancel](../decisions/2026-10-08-go-ahead-cancel-and-unheld-posts.md) |
| 1.0 | Signed by William | none |
| 1.1 | Contract, found while building: a post not yet held has no draft check page, so the invite page and the brand's deal page cancel through their own routes (`POST /deals/{id}/invite/posts/{id}/cancel`, `POST /brand/deals/{id}/posts/{id}/cancel`), each answering with that page's data, and their posts carry `cancel` and `cancelled`. A side's own note isn't repeated back to it. No other requirement changes | none |
| 1.1 signed | Revision 1.1 signed by William | none |
