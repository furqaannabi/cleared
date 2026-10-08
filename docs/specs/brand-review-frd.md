# Brand review: FRD

**Status:** Signed by William (revision 1.0). The objection rule and review links are decided by William; Furqaan can supersede them.

**Surface:** Both sides of step 5 of [How a deal runs](../PRODUCT.md#how-a-deal-runs). **The brand's side:** each post's review status on the brand's deal page, and a review page per post where the brand answers the creator's asks, then approves the draft or objects to items in the 48-hour review window. **The creator's side** (amending the [creator draft check](creator-draft-check-frd.md), revision 1.14): objections, the approved state, and a link to send the brand.

**Scope of this build:** frontend only, against provisional mocks (see [Mocks and the provisional contract](#mocks-and-the-provisional-contract)). The review window's timer, deliverable states, review links and email run on the backend; the frontend starts actions and shows what the API returns. It never decides when a window starts or ends, or anything about money. Requirements tagged **Depends on backend** name their fallback.

## Problem Statement

The brand has reserved its money and is waiting for a video. When the draft is ready it needs to see, item by item, whether the video does what its brief asked, with the evidence, and to say yes or say exactly what's wrong while the video can still be changed. It needs to know how long it has, what happens if it says nothing, and that its money is taken only once the post is live. When the creator asks it to accept something the check was unsure about, it needs to see why before answering.

The creator needs to know whether the brand approved, objected or said nothing, what exactly the brand wants changed, and that they mustn't publish until the hold is re-confirmed.

## Solution

Each post on the brand's deal page shows where its draft stands and, when the brand has something to do, a "Review draft" link. The review page mirrors the creator's draft check: the video and its timeline, every item with its status, the brief line it came from and its evidence (an AG Grid from `md:`, cards on phones), and the post's hold. It shows only the latest draft, and only once the brand has something to do.

When the creator asks about an Unsure item, the brand can accept it or ask the creator to fix it. When every item passes, the brand has 48 hours: it can approve the draft, or object to one or more items, each with a note. An objection stops the clock; the creator then uploads a new draft that fixes it, or the brand approves the draft anyway. If neither happens by the deadline, the hold goes back to the brand ([decision](../decisions/2026-10-08-objection-settled-by-the-two-sides.md)). Each time a draft needs the brand, Cleared makes a fresh link for it, emails it if there's a brand email, and the creator can copy it to send themselves ([decision](../decisions/2026-10-08-fresh-brand-link-per-review.md)).

This spec ends at "Approved". Re-confirming the hold and publishing are step 6.

## User Stories

**The brand**

1. As a brand, I want each post on my deal page to say where its draft stands, so that I know whether anything needs me.
2. As a brand, I want a clear "Review draft" when a post needs me, so that I go straight to it.
3. As a brand, I want to be emailed a link when a draft needs me, so that I don't have to check back.
4. As a brand, I want a review link to open that post's review directly, so that I don't hunt for it.
5. As a brand, I want to see the draft video with markers where each item happens, so that I can check the moments myself.
6. As a brand, I want every item's status as an icon and a word, so that I never read meaning from colour alone.
7. As a brand, I want each item to quote the line of my brief it came from, so that I judge the video against what I asked for.
8. As a brand, I want each item's evidence with a timestamp I can click, so that I can see the proof.
9. As a brand, I want items checked only after posting to say so, so that I know they aren't forgotten.
10. As a brand, I want to see the post's hold and deadline on the review page, so that I know what's at stake.
11. As a brand asked about an Unsure item, I want to see why the check was unsure, so that I answer knowingly.
12. As a brand, I want to accept an Unsure item, so that a judgment call I'm happy with doesn't force a reshoot.
13. As a brand, I want to ask the creator to fix an Unsure item, with an optional note, so that they know what I want.
14. As a brand, when every item passes, I want to see how long I have to review and when it ends in my own time, so that I don't miss it.
15. As a brand, I want to know that saying nothing approves the draft, so that silence is a choice I make knowingly.
16. As a brand, I want to approve the draft early, so that the creator can move on.
17. As a brand, I want to be told what approving means for my money before I confirm, so that I approve knowingly.
18. As a brand, I want to object to a specific item with a note, so that the creator knows exactly what to change.
19. As a brand, I want to object to several items at once, so that the creator fixes everything in one new draft.
20. As a brand, I want to see, edit and remove my objections before sending, so that I send what I mean.
21. As a brand, I want a warning in the last hour of the window, so that I send my objections in time.
22. As a brand whose window ended while I was writing, I want to be told the draft was approved and still see what I wrote, so that nothing vanishes silently.
23. As a brand who objected, I want to see my objections and what happens next, so that I know whose move it is.
24. As a brand who objected and changed my mind, I want to approve the draft anyway, so that the creator isn't left waiting until the deadline.
25. As a brand, after approving, I want to know that the creator posts next and when my money is taken, so that I know what follows.
26. As a brand, I never want to see the creator's earlier drafts, coaching or how many tries they needed, so that I judge only the latest draft against the checklist.
27. As a brand with a link that has expired, I want to know to ask the creator for a new one, so that I'm not stuck.

**The creator**

28. As a creator whose draft the brand is reviewing, I want to copy a link for the brand, so that I can nudge them myself.
29. As a creator, I want an objected item to say the brand objected, with their note, so that I know exactly what to change.
30. As a creator, I want to see that the check passed an item the brand objected to, so that I know who said what.
31. As a creator, I want to know an objection stopped the clock and what I can do before the deadline, so that I'm not left guessing.
32. As a creator, I want to know when the brand approved, or that the window ended with no objection, so that I know the draft is approved.
33. As a creator with an approved draft, I want to be told not to publish yet, so that I never publish without a confirmed hold.
34. As a creator demoing on mock data, I want to send a draft that passes, or one with an Unsure item, so that the brand's side can be shown from a deal I made.

**Both**

35. As a brand or creator on a phone, I want these pages to work at 375 px with 44 px targets, so that I can do this anywhere.
36. As a keyboard or screen-reader user, I want every control reachable and named, and the countdown and state changes announced, so that I can use the pages without a mouse.

## Functional requirements

### The brand's deal page

| ID | Requirement |
| --- | --- |
| RW-FR-01 | **Each post's draft.** Once a post is held (CH-FR-18), its line on `/brand/deals/{dealId}` adds where its draft stands, from the API: no draft to show yet ("{creator} is working on the draft · Post by {date}"); an ask ("{creator} asked you about {n} items" and "Review draft"); in the window ("Draft ready for your review · {time left}" and "Review draft"); objected ("You asked {creator} to fix {n} items · Waiting for a new draft" and "View draft"); approved ("Approved · {creator} posts by {date}"); released (CH's released wording, "The hold came back to you"). CH-FR-19's "All held" line stays until the first post moves on. |
| RW-FR-02 | **The order.** Posts that need the brand (an ask, or in the window) come first, the one whose window ends soonest at the top. |

### Getting in

| ID | Requirement |
| --- | --- |
| RW-FR-03 | **A review link.** A review link (`/b/{token}`, like the invite link) goes through CH-FR-01's swap and lands on that post's review page, with the token gone from the URL. A review link that doesn't work shows CH-FR-02's one message. **Depends on backend** for making and emailing links; on mocks the demo link and "Open as {brand}" stand in. |
| RW-FR-04 | **No session.** The review page without a session for its deal shows CH-FR-03's message. |

### The review page

| ID | Requirement |
| --- | --- |
| RW-FR-05 | **Where it lives.** `/brand/deals/{dealId}/deliverables/{deliverableId}`, in the brand frame (CH-FR-04), with a crumb back to the deal ("{brand} × {creator}") and the post's name as the title. Ids are opaque values from the API. A deliverable that isn't in the session's deal shows "We couldn't find this post." |
| RW-FR-06 | **Only when the brand has something to see.** The page shows a draft only when the API sends one for the brand: from the creator's first ask on a run, or from the start of the review window. Before that it says "{creator} is working on the draft. You'll get a link when there's something to review." with the post's hold and deadline. |
| RW-FR-07 | **The latest draft, its facts only.** The player and timeline (DC-FR-23 to DC-FR-26) and every item with its status, kind, timestamp, brief line (or "Added by {creator}"), evidence and how it was checked (DC-FR-12), from the API's latest run. The page has no Suggested fix, no changes since the last draft, no run number and no earlier drafts. Items checked only after posting show At live check with "Checked once {creator} posts." |
| RW-FR-08 | **Statuses, for the brand.** One mapping, shared with DC-FR-13's icons and colours, worded for the brand: Passed; Fix needed ("{creator} is fixing this"); Unsure; At live check; "{creator} asked you" (an ask, unanswered); "You accepted"; "You asked for a fix"; "You objected". Every status is an icon and a word; "You accepted" is never the pass colour. |
| RW-FR-09 | **Grid and cards.** From `md:` the items are an AG Grid; below `md:` a stack of expandable cards. Both come from one source and show the same status, brief line, evidence and timestamp for every item (DC-FR-40, DC-FR-41). Selecting an item selects it everywhere and seeks the video (DC-FR-22). |
| RW-FR-10 | **Hold and deadline.** The post's hold ("Held · {amount} · PayPal ref {reference}") and "{creator} posts by {date}" (DC-FR-44's shared date with the viewer's own time). The brand's page has no money actions. |
| RW-FR-11 | **What happens next.** In every state one or two sentences say what happens next and who has to act, as in DC-FR-30 and DC-FR-47: a bar from `md:`, a panel on phones. |

### Answering an ask

| ID | Requirement |
| --- | --- |
| RW-FR-12 | **Asked about.** An item the creator asked about leads the page and is selected on load, with the AI's evidence and why it was unsure. It has two actions: "Accept" and "Ask {creator} to fix it". The next-step text says "{creator} asked you to accept {n} items. Nothing else needs you until every item passes." |
| RW-FR-13 | **Accept.** Accepting shows the item as "You accepted"; on the creator's side it is Accepted by brand (DC-FR-16). If it was the last open item and the API reports the window started, the page moves to RW-FR-15. |
| RW-FR-14 | **Ask to fix.** Opens a note field in place (optional, plain text, up to 500 characters) and "Send to {creator}". The item then shows "You asked for a fix" with the note; on the creator's side it is declined (DC-FR-17). Neither answer can be changed on that draft. |

### The review window

| ID | Requirement |
| --- | --- |
| RW-FR-15 | **Window open.** When the API reports the window has started: "Every item passed. You have until {date, time} to review" (with the viewer's own time per DC-FR-44) and the time left, and "If you say nothing, the draft is approved." Two actions: "Approve draft" and "Object to an item". |
| RW-FR-16 | **Approve.** "Approve draft" opens an inline confirmation in place (not a modal): "Approve this draft? {creator} can then post it. Your {amount} is taken only once the live post checks out." with "Yes, approve" and "Not yet". |
| RW-FR-17 | **Object.** Every Passed item has "Object", which opens a note field in place (required, plain text, up to 500 characters). Saved objections show beside their items with Edit and Remove; a bar says "{n} objections" and "Send to {creator}". Items the brand accepted and At live check items have no "Object" (RW-BR-03). |
| RW-FR-18 | **Send objections.** "Send to {creator}" opens an inline confirmation listing each item and note: "Send {n} objections? The clock stops and {creator} makes a new draft. You can still approve this draft until they do." with "Yes, send" and "Not yet". |
| RW-FR-19 | **Last hour.** In the window's last hour the time left leads, with "Less than an hour left to object." |
| RW-FR-20 | **Window ended.** When the API reports the window ended with no objection, the page shows RW-FR-22. If the brand was writing objections, it adds "The review window ended at {time}, so this draft is approved. Your objections weren't sent." and keeps the unsent notes visible, read-only, so they can be copied. A send the API refuses as too late shows the same. |

### After the brand answers

| ID | Requirement |
| --- | --- |
| RW-FR-21 | **Objected.** "You asked {creator} to fix {n} items. The clock has stopped. {creator} makes a new draft by {date}; if they don't, the hold comes back to you." The objections are listed with their notes, read-only. One action: "Approve this draft anyway", with RW-FR-16's confirmation. No objections can be added, edited or withdrawn one by one. |
| RW-FR-22 | **Approved.** "Approved · {date}" ("by you", or "No objection in 48 hours" when the window ended), then "{creator} posts by {date}. Your {amount} is taken only once the live post checks out." No actions. |
| RW-FR-23 | **A new draft.** When the creator uploads a new draft after an objection or a fix request, the page shows nothing new until RW-FR-06 applies again; earlier objections, acceptances and fix requests aren't carried over (DC-BR-04). |
| RW-FR-24 | **Released.** When the API reports the hold was released, the page says so with the date and why, read-only, as on the creator's side (DC-FR-10). |

### The creator's side (DC 1.14)

| ID | Requirement |
| --- | --- |
| RW-FR-25 | **Copy link for the brand.** While the brand has something to do on a post (an ask waiting, the window open, or objected), the creator's draft check page shows "Copy link for {brand}" beside the next step, and "We've emailed it to {email}" when there's a brand email. **Depends on backend** for the link; on mocks it copies the demo link. |
| RW-FR-26 | **Objected, for the creator.** Specified in DC 1.14 (DC-FR-49, DC-FR-50): each objected item shows "{brand} objected" with the note, and the next step names the items and the deadline. |
| RW-FR-27 | **Approved, for the creator.** Specified in DC 1.14 (DC-FR-51): "{brand} approved this draft" or "No objection from {brand} in 48 hours, so this draft is approved", then "Don't publish yet. Cleared confirms {brand}'s hold with PayPal first." |
| RW-FR-28 | **Demo draft.** In mock builds only, DC-FR-45's simulated upload lets the creator pick the run's outcome: "passes every item" (the window starts) or "one Unsure item". Supplied only through the mock gate, like Demo PayPal; never in a real build. |

### Responsive and accessibility

| ID | Requirement |
| --- | --- |
| RW-FR-29 | Mobile-first at 375 px (designed at 390 px first): one column with the work first (banner, what happens next, player, items, then the hold), every target at least 44 px, note fields full width, the brand's actions in a bar fixed to the bottom on phones, no sideways page scroll. Layout from `md:` follows the creator's draft check (DESIGN.md). |
| RW-FR-30 | Every control is reachable by keyboard and named ("Object to {item}", "Accept {item}"); timeline markers as DC-FR-24; the countdown is announced at most when it crosses the last hour, not every minute; accepting, sending, approving and a window that ended are announced politely; reduced motion is respected. |

## Business rules

| ID | Rule |
| --- | --- |
| RW-BR-01 | Silence approves a fully passing draft and nothing else. The API decides when the window starts and ends; the page only reflects it. Unsure, waiting and objected items never clear on a timer. |
| RW-BR-02 | An objection names one item and carries a note. The brand can't raise anything that isn't on the checklist. |
| RW-BR-03 | Objections are only possible during the window and only on items that passed; not on items the brand accepted, nor on At live check items. |
| RW-BR-04 | One review per draft: objections are sent once; afterwards the brand can only approve the draft anyway. A new draft gets a new review ([decision](../decisions/2026-10-08-objection-settled-by-the-two-sides.md)). |
| RW-BR-05 | After an objection, the deliverable waits on the two sides: a new draft from the creator, or the brand's approval. At the deadline with neither, the hold is released to the brand. |
| RW-BR-06 | The brand sees only the latest draft, and only from an ask or the window's start. Never the Suggested fix, run history or run number. |
| RW-BR-07 | Approving never moves money. The page states the consequence; capture follows the live check (step 7). The frontend decides no money state. |
| RW-BR-08 | Review links follow the invite link's rules: unguessable, scoped to one deal, expiring, swapped for a session, never stored, logged or left in the URL ([decision](../decisions/2026-10-08-fresh-brand-link-per-review.md)). |
| RW-BR-09 | Notes, objections and evidence are untrusted plain text: shown as text, never as markup, never acted on, never logged. |

## Implementation Decisions

- **Routes:** the brand's review page at `/brand/deals/[dealId]/deliverables/[deliverableId]`, in the brand frame. The creator's draft check page stays where it is and gains DC 1.14's states.
- **Modules:**
  - A pure **brand review view**, turning the API's deliverable for the brand into the page's state (nothing to show, asked, window open, last hour, objected, approved, released), the next-step text, which actions are on, the default selection and each item's brand-worded status. Most of this spec's rules are tested here.
  - The **item status map** gains the brand's wording beside the creator's; one mapping, so icons and colours never differ between sides.
  - A pure **objection draft** (the unsent objections: add, edit, remove, which items allow one), mirroring CH's notes and kept in memory only.
  - The draft check's player, timeline, grid, cards and evidence panel are reused with a side prop for wording; the brand's actions live in their own components under `brand-review/`, each under ~200 lines.
- **Data:** Zod schemas for the brand's deliverable; the typed client gains the brand calls (read, accept, ask to fix, approve, send objections) and the creator's review link call.
- **Mocks:** the seed gains a held demo deal whose posts are in the brand's states (one in the window with 31 hours left, one with an Unsure item asked about, one approved) and its own demo link. DC-FR-45's simulated upload gains the outcome choice (RW-FR-28). A mock-only control ends a window now, so RW-FR-20 can be shown.
- **Visual:** inherits DESIGN.md and the creator's draft check. Rendered mockups in `design/brand-review/` before build, at 390 px and desktop; William picks.

## Mocks and the provisional contract

```ts
// Provisional. Not an agreed contract.
interface BrandDeliverable {
  dealId: string;
  deliverableId: string;
  creatorName: string;
  brandName: string;
  platform: "youtube_video" | "youtube_short" | "instagram_reel";
  hold: { amount: string; reference: string; deadline: string };  // as CH, held
  creatorTimeZone: string;
  review:
    | { state: "nothing_yet" }
    | { state: "asked" }                       // at least one ask waiting
    | { state: "window"; endsAt: string }      // ISO date-time
    | { state: "objected"; objectedAt: string }
    | { state: "approved"; approvedAt: string; by: "brand" | "window" }
    | { state: "released"; releasedAt: string; reason: "deadline" | "cancelled" };
  draft?: {                                    // absent at nothing_yet
    videoUrl: string;                          // short-lived
    lengthSec: number;
    aspectRatio: "16:9" | "9:16";
    items: {
      id: string; name: string; kind: string; checkedBy: string;
      status: "passed" | "fix_needed" | "unsure" | "at_live_check"
        | "asked" | "accepted" | "fix_requested" | "objected";
      briefLine?: { number: number; text: string };  // absent when the creator added it
      evidence?: { label: string; text: string; startSec?: number; endSec?: number };
      note?: string;                           // the brand's, on fix_requested and objected
    }[];
  };
}
```

The creator's deliverable (DC) gains `state: "objected" | "approved"`, item status `objected` with `brandNote`, and `reviewLink?: { url: string; emailedTo?: string }`.

### Requests for Furqaan

| For | Needs |
| --- | --- |
| RW-FR-01 | `GET /brand/deals/{id}` gains each post's `review.state` and counts (asks, objections) |
| RW-FR-03, RW-BR-08 | Review links: made when a window starts or the creator asks about an item; expire when the brand has nothing left to do on that draft (approved, a new draft, or released) or after 7 days, whichever is first; swapped for a deal-scoped session by `POST /b/{token}/session`, which returns where to land (`dealId`, `deliverableId`); emailed to the brand email (SES, as IN-FR-13) |
| RW-FR-05 to RW-FR-10 | `GET /brand/deals/{id}/deliverables/{deliverableId}`: the shape above; no `fixHint`, `previousStatus`, run number or earlier runs; refused for a deliverable outside the session's deal; the video URL as DC-FR-26 |
| RW-FR-13 | `POST …/items/{itemId}/accept`; refused unless the item is asked about |
| RW-FR-14 | `POST …/items/{itemId}/fix` with an optional `{ note }`; refused unless the item is asked about |
| RW-FR-16, RW-FR-21 | `POST …/approve`: allowed in the window or when objected; ends the window; `approved` |
| RW-FR-17, RW-FR-18 | `POST …/objections` with `{ objections: { itemId, note }[] }`, sent once per draft; refused outside the window, on items that didn't pass, on accepted or At live check items, and when the window has ended (a distinct "too late" answer for RW-FR-20); stops the window's timer; `objected` |
| RW-FR-15, RW-FR-20 | The window's timer is server-side; at its end with no objection the deliverable is `approved` with `by: "window"` |
| RW-BR-05 | From `objected`: a new draft starts a new run (DC-BR-04 cancels the objections); the deadline releases the hold as from any other state |
| RW-FR-25 | The creator's deliverable gains `reviewLink` while the brand has something to do |
| Mocks only | `POST /__demo/review/end-window` ends a window now. It exists only in the MSW mocks and is never part of the real API |
| Security | Every changing brand request sends the session cookie and is protected from cross-site requests, as DC's security request |

## Testing Decisions

- Tests check what the brand and creator see and can do, named after the RW-FR they prove.
- **Brand review view:** every state and its next-step text; which actions are on in each; ask items selected first; the last hour; a window that ended with unsent objections; never a fix hint, run number or earlier run even when sent.
- **Status map:** every brand-worded status has an icon and a word; "You accepted" never the pass colour; both sides share icons and colours.
- **Objection draft:** add, edit, remove; refused on accepted, At live check and non-passing items; a note is required.
- **Components:** the deal page's post lines in each state and their order; the review page in each state at 375 px and desktop; grid and card parity; accept, ask to fix with and without a note; approve and send with their confirmations; approve anyway; the late send; creator side: Copy link, objected items, approved, "Don't publish yet", the demo outcome choice.
- **End to end (Playwright, on MSW):** a held post → the creator's demo draft with one Unsure item → asks the brand → the brand accepts → the window opens → the brand objects to an item → the creator sees "{brand} objected" → a new demo draft that passes → the brand approves → both sides show Approved and the creator sees "Don't publish yet". Also: the window ends with no objection. At 375 px and 1280 px.

## Out of Scope

- Step 6 onward: re-confirming the hold, publishing, the live check and payment.
- Manual approval outside an objection in the review window (the live check; Instagram's paid-partnership label).
- The real upload flow (DC-FR-45 stands in).
- Real email sending and the PayPal JS SDK.
- A brand account, notifications other than the review link email, and the brand seeing earlier drafts.
- Cancelling a deal.

## Open items

- **Review link expiry:** assumed 7 days, or sooner once the brand has nothing left to do on that draft (Furqaan to review).
- **A brand that never answers an ask:** the item waits with no limit (DC-FR-18); the deadline releases the hold as usual.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: an objection is settled by the two sides; a review page per post mirroring the draft check; the brand sees the latest draft only from an ask or the window's start; approve, or object to one or more items with notes; accept or ask to fix an Unsure item; a fresh link per review moment and "Copy link" for the creator; after objecting, only "Approve this draft anyway"; "{brand} objected" for the creator; the brand sees the facts only; inline confirmations; the window's end is final, with a last-hour warning; a seeded deal and a demo draft outcome; ends at Approved with "Don't publish yet" | [Objection settled by the two sides](../decisions/2026-10-08-objection-settled-by-the-two-sides.md), [Fresh brand link per review](../decisions/2026-10-08-fresh-brand-link-per-review.md) |
| 1.0 | Signed by William | none |
