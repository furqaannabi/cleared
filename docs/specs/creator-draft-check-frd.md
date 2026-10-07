# Creator draft check: FRD

**Status:** Signed by William (revision 1.8). Ask-the-brand (DC-FR-14 to DC-FR-18, DC-BR-02 to DC-BR-04), the deadline timezone (DC-FR-44) and the Suggested fix (DC-FR-46) are decided by William; Furqaan can supersede them.

**Surface:** Creator app. The page a creator sees for one deliverable while it is at step 4 of [How a deal runs](../PRODUCT.md#how-a-deal-runs), plus the hand-off into step 5 and the released state.

**Scope of this build:** frontend only, against provisional mocks (see [Mocks and the provisional contract](#mocks-and-the-provisional-contract)). Requirements tagged **Depends on backend** need data the backend has not agreed to provide; each one names its fallback.

## Problem Statement

A creator who has finished a sponsored video does not know, item by item, whether it does what the brief asked. When something is wrong they find out after publishing, when the video can no longer be fixed, or they hear nothing and payment sits "in processing". They cannot see whether the brand's money is still there, what is holding things up, or whose move it is.

## Solution

One page per deliverable shows the draft check: every checklist item with its result, the line of the brief it came from, and timestamped evidence that seeks the draft video. The money held for this deliverable sits on the same screen. A next-step bar always says what happens next and who has to act. While the check runs, the page says so; if the check cannot run, the page says why and whose problem it is; if the deliverable ends, the page says where the money went.

When the AI is unsure about an item, the creator can fix it in a new draft or ask the brand to accept it. Nothing unsure ever clears on a timer.

## User Stories

1. As a creator, I want to open a deliverable and see at once whether my draft passed, so that I know whether I have work to do.
2. As a creator, I want every checklist item to show Passed, Fix needed, Unsure or At live check as an icon and a word, so that I never have to read meaning from colour alone.
3. As a creator, I want each item to show the line of the brief it came from, so that I can see the brand asked for it.
4. As a creator, I want each item to show its evidence (a transcript line, on-screen text or a described video moment), so that I can see why it passed or failed.
5. As a creator, I want to click an item's timestamp and have the draft jump to that moment, so that I can see the evidence for myself.
6. As a creator, I want seal markers on the draft's timeline for every timestamped item, so that I can see where in the video each item was found.
7. As a creator, I want duration items (such as a 45-second segment) shown as a band on the timeline, so that I can see the whole segment.
8. As a creator, I want to see how each item was checked (exact match, AI with a timestamp, worked out from timestamps, checked on the published post), so that I know how much to trust it.
9. As a creator, I want items that can only be checked after publishing marked "At live check" with a plain explanation, so that I don't think they failed.
10. As a creator, I want the first item that needs me selected when I open the page, so that I land on what matters.
11. As a creator, I want to filter the checklist to Needs you, Passed, Waiting for brand and At live check, with counts, so that I can focus.
12. As a creator, after uploading a fix, I want each item to show what changed since the last run ("Was Fix needed, now Passed"), so that I know my fix worked and nothing else broke.
13. As a creator, I want to see the held amount, its PayPal reference, the date it was held, its stage and the PayPal email it pays out to, next to the evidence, so that I know the money is there.
14. As a creator, I want a next-step bar that tells me in one or two sentences what to do and why, so that I am never left guessing.
15. As a creator on my phone, I want the next-step bar fixed to the bottom with a full-width action, so that the next step is always one tap away.
16. As a creator on my phone, I want the checklist as cards that expand to show evidence and the brief line, so that nothing scrolls sideways.
17. As a creator on a tablet or desktop, I want the checklist as a grid beside an evidence panel, so that I can scan many items and read one in detail.
18. As a creator, I want the page to tell me plainly when there is no draft yet and how to upload one, so that I know how to start.
19. As a creator, I want to see that my draft is being checked, against how many items, and for how long, so that I know it hasn't stalled.
20. As a creator, I want to see which stage of the check is running, so that I can tell it is making progress.
21. As a creator, I want results to appear item by item as they are ready, so that I can start reading before the whole check finishes.
22. As a creator, I want to know I can leave the page while the check runs, so that I don't feel tied to the screen.
23. As a creator, I want to ask the brand to accept an item the AI is unsure about, so that a judgment call doesn't force me to reshoot.
24. As a creator, I want an item I've asked about to say "Waiting for Glow Theory", so that I know whose move it is.
25. As a creator, I want to withdraw an ask, so that I can decide to fix the item myself instead.
26. As a creator, I want an item the brand accepted to say "Accepted by Glow Theory", distinct from Passed, so that it's clear the brand, not the AI, approved it.
27. As a creator, I want an item the brand declined to say so, with the brand's note, so that I know what to fix.
28. As a creator, I want to be unable to ask the brand to accept a failed item, so that the rules are the same for everyone.
29. As a creator, I want to know that uploading a new draft cancels my open asks and the brand's acceptances, so that I'm not surprised.
30. As a creator, when every item passes, I want to see that the brand's 48-hour review has started and when it ends, so that I know when I can publish.
31. As a creator, when my file can't be checked, I want to know exactly what is wrong with it and what to do, so that I can fix it quickly.
32. As a creator, when the check fails on Cleared's side, I want to be told it isn't my fault and what happens next, so that I don't waste time re-uploading.
33. As a creator, when a check fails, I want my previous results to stay on screen, so that I don't lose what I already knew.
34. As a creator, when a check fails, I want to be told my hold is still in place, so that I don't worry about the money.
35. As a creator, when fewer than 3 days remain and my draft isn't fully passing, I want the deadline to lead the next-step bar, so that I don't miss it.
36. As a creator, when the deadline passes or the deal is cancelled, I want the page to say the hold went back to the brand, when, and why, so that I understand the outcome.
37. As a creator, after a deliverable ends, I want to still see its last results read-only, so that I have a record.
38. As a creator with a Short or a Reel, I want the vertical video shown properly next to the evidence, so that the page doesn't waste the screen.
39. As a creator, I want the draft video to keep playing if its link expires while I'm on the page, so that I'm not interrupted.
40. As a creator, I want a clear message if the video can't be loaded, so that I'm not left with a broken frame.
41. As a creator, I want to see my deals in the rail with each one's current step, so that I can move between deals.
42. As a creator on a phone or tablet, I want the deals list in a full-screen menu from the top bar, so that I can switch deals on a small screen.
43. As a creator with several deliverables in a deal, I want a switcher showing each deliverable's platform and step, so that I can move between them in one tap.
44. As a creator, I want to see the deal's steps with the current one marked, so that I know where this deliverable is in the whole deal.
45. As a creator, I want the selected item and filter kept in the URL, so that Back works and a link can open a specific item.
46. As a creator, I want a deal link with no deliverable to open the deliverable that needs me, so that I land in the right place.
47. As a creator, I want a plain "couldn't find" page for a deal that doesn't exist or isn't mine, so that I'm not shown an error dump.
48. As a creator who prefers reduced motion, I want the page to stay still, so that it is comfortable to use.
49. As a creator using a keyboard or screen reader, I want every marker, card, tab and action reachable and named, so that I can use the page without a mouse.
50. As a creator with a Fix needed item, I want one plain sentence saying what to change, so that I don't have to work out the fix from the evidence and the brief line.
51. As a creator with an Unsure item, I want a suggestion for showing it more clearly next to the Ask button, so that I can choose between a new draft and asking the brand.
52. As a creator whose ask the brand declined, I want the brand's note first and then the suggestion, so that the brand's own words come before Cleared's.
53. As a creator, I want the suggestion to read as advice, not a promise, so that I know the next draft check still decides.
54. As a creator whose item passed, I never want to see an old suggestion beside a Passed chip.

## Functional requirements

### Page states

| ID | Requirement |
| --- | --- |
| DC-FR-01 | The page shows exactly one of six states, taken from the deliverable's state in the API: **no draft**, **checking**, **results**, **fully passing**, **check failed**, **released**. The page never works out the deliverable's state itself; it renders the state the API reports. |
| DC-FR-02 | **No draft.** The checklist shows every item with its kind and brief line. Items checked at the draft check show **Not checked yet**; items checked only after publishing show **At live check**. The next-step bar says to upload the draft and names the deliverable's deadline. Its primary action is "Upload draft". The upload flow itself is out of scope (see [Open items](#open-items)). |
| DC-FR-03 | **Checking (baseline).** Every item checked at the draft check shows the status **Checking**; items checked only after publishing keep **At live check**. The filter tabs are hidden. The next-step bar says the draft is being checked against the N items that can be checked before publishing, that the creator can leave the page, and how long ago the check started ("Started 2 min ago"), computed on the client. No estimate of time remaining is shown unless the API supplies one. |
| DC-FR-04 | **Checking: stages.** **Depends on backend.** The page lists the check's stages in plain words (for example "Reading what's said", "Reading on-screen text", "Watching the video", "Checking each item"), each done, current or waiting. Fallback: DC-FR-03 only. |
| DC-FR-05 | **Checking: item by item.** **Depends on backend.** Each item changes from Checking to its result as the API reports it, while the rest stay Checking. Fallback: all results appear together when the check finishes. |
| DC-FR-06 | **Results.** Shown when the latest run has finished and at least one draft-check item is Fix needed, Unsure or Waiting for brand. |
| DC-FR-07 | **Fully passing.** Shown when the API reports that the review window has started. The next-step bar names the brand and when the review window ends ("Glow Theory has until 9 Oct, 14:00 to review. If they say nothing, you're cleared to publish."). There is no primary action for the creator. The brand's review screen is out of scope. |
| DC-FR-08 | **Check failed: the file.** When the API reports that the file could not be checked because of the file (unreadable, unsupported format, longer than the length cap, or not the same video as the YouTube unlisted upload), the page shows a banner saying what is wrong and what to do, with the action "Upload again". The length cap is a value from the API and is never hard-coded. |
| DC-FR-09 | **Check failed: our side.** When the API reports a processing failure, the banner says it is not the creator's fault and what happens next. **Depends on backend** for automatic retry ("We're trying again; you don't need to do anything."). Fallback: "Something went wrong on our side checking this draft." with the action "Try again". |
| DC-FR-10 | **Released.** When the API reports the hold was released (missed deadline or cancelled deal), the page is read-only: the last run's results stay visible, and the upload and ask actions are removed. The next-step bar says what happened, when and, if the API says, who cancelled, and that nothing more can happen on this deliverable. There is no primary action. |
| DC-FR-11 | **Deadline warning.** In the no draft, results and check failed states, when fewer than 3 days remain before the deliverable's deadline, the next-step bar leads with the time left ("2 days left to post."). This changes emphasis only, not any timing. |

### Checklist and evidence

| ID | Requirement |
| --- | --- |
| DC-FR-12 | Every item shows: its status as a seal and a chip (icon and word), its name, its kind, its timestamp or time range where it has one, the brief line it came from (line number and text), its evidence, and how it was checked. |
| DC-FR-13 | Item statuses and how each is shown (seal, icon, word, colour) come from one mapping, used by every rendering: |

| Status | Icon and word | Colour |
| --- | --- | --- |
| Passed | check, "Passed" | pass |
| Fix needed | cross, "Fix needed" | fail |
| Unsure | question, "Unsure" | unsure |
| At live check | clock, "At live check" | waiting |
| Checking | spinner, "Checking" (static under reduced motion) | waiting |
| Not checked yet | dot, "Not checked yet" (no draft only) | none, ink-4 text |
| Waiting for brand | clock, "Waiting for {brand}" | unsure |
| Accepted by brand | check in circle, "Accepted by {brand}" | waiting, with an espresso icon; never green |

| ID | Requirement |
| --- | --- |
| DC-FR-14 | **Ask the brand to accept.** An Unsure item has the action "Ask {brand} to accept". Taking it changes the item to Waiting for brand. No other status offers the action. |
| DC-FR-15 | **Withdraw an ask.** A Waiting for brand item has the action "Withdraw". Taking it returns the item to Unsure. |
| DC-FR-16 | **Accepted.** When the API reports that the brand accepted an item, it shows Accepted by brand. |
| DC-FR-17 | **Declined.** When the API reports that the brand declined an item, it shows Unsure with "{brand} asked you to fix this" and the brand's note if there is one. It cannot be asked about again in the same run. |
| DC-FR-18 | **No answer.** A Waiting for brand item stays waiting with no time limit. While any item is waiting, the next-step bar names the brand and shows the deliverable's deadline. |
| DC-FR-19 | **Change since last run.** From run 2 on, an item whose status differs from the previous run shows the change ("Was Fix needed, now Passed"; "Was accepted by Glow Theory, now Unsure"). Only the latest run is shown; earlier runs cannot be opened. |
| DC-FR-20 | **Filter tabs.** All; Needs you (Fix needed, Unsure); Passed (Passed, Accepted by brand); Waiting for brand (shown only when its count is above 0); At live check. Each tab shows its count. An empty tab says "Nothing here right now." |
| DC-FR-21 | **Default selection.** On load, with no item in the URL, the first Fix needed item is selected; else the first Unsure; else the first item. |
| DC-FR-46 | **Suggested fix.** When the API sends an item's `fixHint`, an item that is Fix needed, Unsure (including one the brand declined) or Waiting for brand shows it as "Suggested fix": one plain sentence saying what to change. It sits after the evidence and before the brief line, in the evidence panel (tablet and up) and in the expanded item card (phones); on a declined item it comes after the brand's note. The grid and the collapsed card do not show it. No other status shows a hint, even if one is sent. With no hint, nothing is shown (no placeholder). The hint is plain text: no links or formatting, and it never changes the item's status, the checklist or the money. |
| DC-FR-22 | **Selecting an item** from the grid, a card or a timeline marker selects it everywhere: the evidence panel (tablet and up) or the expanded card (phone), the grid row, the timeline marker, and the video seeks to its timestamp. The change moves in one 200–350 ms ease-out step. |

### Draft player

| ID | Requirement |
| --- | --- |
| DC-FR-23 | The player plays the draft file from a short-lived URL supplied by the API. Clicking a timestamp anywhere seeks the video. |
| DC-FR-24 | The timeline under the player shows a seal marker for every item with a single timestamp and a band for every item with a time range. Each marker is a button named with the item, its status and its time. |
| DC-FR-25 | The player takes the deliverable's aspect ratio: 16:9 for YouTube videos; 9:16 for Shorts and Reels. At 9:16 on tablet and up, the player is a narrow column with the timeline below and the evidence panel beside it, keeping the money card and evidence above the fold. On phones a 9:16 player is capped at about 60% of the viewport height. |
| DC-FR-26 | When the video URL expires, the page asks the API for a fresh one without interrupting the creator. If that fails, the player says plainly that the video can't be loaded right now and offers "Try again". |

### Money card

| ID | Requirement |
| --- | --- |
| DC-FR-27 | The money card shows the held amount, the PayPal reference, the date held, the money stage track (Held → Confirmed → Captured → Paid, current stage marked) and the PayPal email it pays out to. Amounts render from integer minor units or decimal strings with tabular figures. |
| DC-FR-28 | In the check failed states, the page says the hold is still in place, with the amount. |
| DC-FR-29 | In the released state, the money card says "Released to {brand}" with the date, and the four-stage track is replaced by a single Released stage. A PayPal reference is shown only if the API supplies one. |

### Next-step bar

| ID | Requirement |
| --- | --- |
| DC-FR-30 | In every state, the next-step bar says in one or two sentences what happens next and who has to act. On phones it is fixed to the bottom, shows the first sentence only, and has a full-width primary action 48 px tall when there is one. Its secondary action, "View brief", opens the brief read-only: full-screen on phones, a side panel from `md:` up, with the selected item's brief line highlighted. |

### Shell, header and navigation

| ID | Requirement |
| --- | --- |
| DC-FR-31 | **Rail (desktop) and top bar (tablet and phone).** Logo, a deals list (each row: initials avatar, brand name, one-line status such as "Brand review · 31h left", linking to that deal) and the creator's name. On tablet and phone the deals list opens from a "Deals" button (44 px target) as a full-screen sheet. Payouts and Connected accounts are not shown until their specs add them. |
| DC-FR-32 | **Header.** Breadcrumb (Deals › brand › deliverable), title (brand and deliverable), and meta: run number, video length, deadline. |
| DC-FR-33 | **Deliverable switcher.** When a deal has more than one deliverable, pill tabs under the title, one per deliverable, each showing platform and current step, each a link to that deliverable. On phones the pill row scrolls horizontally. |
| DC-FR-34 | **Deal steps.** The seven steps (Checklist agreed, Held, Draft check, Brand review, Publish, Live check, Paid) with done, current and upcoming marked. On phones they become a dot track with "Step N of 7 · {step}". |

### Routes and URL

| ID | Requirement |
| --- | --- |
| DC-FR-35 | The page lives at `/deals/[dealId]/deliverables/[deliverableId]`. Ids are opaque values from the API. No brand, creator or deal name appears in the URL. |
| DC-FR-36 | The selected item and the filter tab are kept in the URL as search parameters (`item`, `tab`). Changing them does not refetch data. Back steps through them. |
| DC-FR-37 | `/deals/[dealId]` redirects to the deliverable whose next step is the creator's; if none, the first deliverable. |
| DC-FR-38 | A deal or deliverable that doesn't exist, or that the creator isn't a party to, shows the same "We couldn't find this deal" page. |
| DC-FR-39 | While the page's data loads, panels show their shape without content. If loading fails for any other reason, the page says so plainly and offers "Try again". |

### Responsive and accessibility

| ID | Requirement |
| --- | --- |
| DC-FR-40 | From `md:` up the checklist is an AG Grid; below `md:` it is a stack of expandable cards. Under 1000 px of grid width the grid drops its Kind and Brief columns. Nothing scrolls sideways. Layout follows DESIGN.md (desktop two columns, tablet one column in the order money card, player, next-step bar, evidence panel, checklist). |
| DC-FR-41 | The grid and the cards show the same status, brief line, evidence and timestamp for every item. |
| DC-FR-42 | Every animation honours `prefers-reduced-motion`. |
| DC-FR-43 | Every interactive element is reachable by keyboard, has a visible focus ring and an accessible name; touch targets are at least 44 × 44 px; nothing depends on hover. |
| DC-FR-44 | **One shared deadline date, with the viewer's own time.** A deliverable's deadline is the end of its day (23:59) in the creator's timezone, so the creator and the brand read the same date ("Post by 24 Oct"). When the viewer's timezone is different, the page adds when it ends for them ("ends 18:59 your time", or "ends 25 Oct, 07:59 your time" when their date differs). Countdowns (DC-FR-11) use the exact moment. |
| DC-FR-45 | **Upload while the upload flow is unspecced.** When mocks are on, the upload actions (Upload draft, Upload new draft, Upload again) open the file picker and simulate a new run: the page shows Checking, then the new results, from the mocks only; nothing is uploaded. When mocks are off, no upload button is shown until the upload flow's FRD is built. |

## Business rules

| ID | Rule |
| --- | --- |
| DC-BR-01 | Unsure is shown as Unsure. Nothing on this page rounds it up to Passed. |
| DC-BR-02 | Only an Unsure item can be asked about. A Fix needed item can only be fixed with a new draft. |
| DC-BR-03 | Accepted by brand counts the same as Passed towards a fully passing draft. The API decides when the review window starts; the page only reflects it. |
| DC-BR-04 | A new draft cancels every open ask and every acceptance from the previous run. |
| DC-BR-05 | A check that fails (DC-FR-08, DC-FR-09) is not a run. The run number does not change, and the previous run's results stay visible. |
| DC-BR-06 | Nothing on this page clears on a timer except what the API reports. Unsure and Waiting for brand never clear by waiting. |
| DC-BR-07 | The page has no money actions. The creator cannot hold, capture, release or pay out from it. |
| DC-BR-08 | Video URLs, PayPal payloads and brand notes are never logged or stored outside memory. Logs carry deal and deliverable ids only. |
| DC-BR-09 | Briefs, evidence text and brand notes are shown as text, never interpreted as markup. |
| DC-BR-10 | All mock data is synthetic and labelled as such on screen. |

## Implementation Decisions

- **Stack:** Next.js, Tailwind v4 with DESIGN.md tokens in the theme, Radix UI primitives, Motion, AG Grid (`docs/decisions/2026-10-06-frontend-stack.md`, `docs/decisions/2026-10-06-evidence-view-ag-grid.md`).
- **Deep modules:**
  - **Deliverable view model** (pure). Takes the deliverable data from the API and returns everything the page shows: the state (DC-FR-01), next-step copy and action (DC-FR-30), default selection (DC-FR-21), tab counts (DC-FR-20), deadline warning (DC-FR-11) and changes since the last run (DC-FR-19). Most of this spec's rules are tested here.
  - **Item status map** (pure). Status → icon, word, colour token, tab (DC-FR-13). The only place statuses are mapped; the grid, cards, timeline and evidence panel all read from it.
  - **API client** (typed, one module). Fetches and validates every response against a schema; a response that fails validation is an error, never partly shown. Refreshes the video URL (DC-FR-26). Maps not-found and not-a-party to one outcome (DC-FR-38).
  - **Mock layer.** MSW handlers over synthetic fixtures, with named scenarios: no draft, checking (with stages and item-by-item results), results run 1, results run 2 with changes, waiting for brand, accepted, declined, fully passing, check failed (file too long, not the same video, our side), released (deadline, cancelled), expired video URL, two deliverables with one 9:16.
- **Components** (shallow, each tested): shell with deals sheet, deliverable header with switcher and deal steps, draft player with timeline, money card, next-step bar, evidence panel, checklist tabs, checklist grid, checklist cards, ask-brand action.
- **Page state comes from the API.** The view model turns API state into what is shown; it never decides deliverable state, the review window or anything about money.
- **Schema validation** uses Zod (`docs/decisions/2026-10-06-schema-validation-zod.md`).
- **Before build:** an `/impeccable` pass designs the 9:16 player layout (DC-FR-25), the stages list (DC-FR-04), the check failed banners (DC-FR-08, DC-FR-09), the released money card (DC-FR-29), the deliverable switcher (DC-FR-33) and the three new statuses (DC-FR-13), and records them in DESIGN.md.

## Mocks and the provisional contract

The mock shape is **provisional**: it follows PRODUCT.md's terms until the API contract is agreed. Trimmed type shape:

```ts
// Provisional. Not an agreed contract.
type ItemStatus = "not_checked" | "checking" | "passed" | "fix_needed" | "unsure"
  | "at_live_check" | "waiting_for_brand" | "accepted_by_brand";

type DeliverableState = "no_draft" | "checking" | "results"
  | "fully_passing" | "check_failed" | "released";

interface ChecklistItem {
  id: string;
  name: string;
  kind: "said" | "shown_as_text" | "shown" | "timing" | "written" | "disclosure" | "publication";
  status: ItemStatus;
  previousStatus?: ItemStatus;          // Requests for Furqaan
  briefLine: { number: number; text: string };
  evidence?: { label: string; text: string; startSec?: number; endSec?: number };
  checkedBy: "exact_match" | "ai_timestamp" | "from_timestamps" | "published_post" | "platform_record" | "person";
  brandNote?: string;                   // Requests for Furqaan
  askable: boolean;                     // Requests for Furqaan
  fixHint?: string;                     // Requests for Furqaan; plain text, at most 280 characters
}
```

### Requests for Furqaan

Fields and endpoints the frontend needs that no contract has yet. Each is mocked, marked provisional, and removed from this spec by a revision if the backend cannot supply it.

Provisional paths, relative to one API base URL and called only through the typed client:

| For | Method and path |
| --- | --- |
| DC-FR-01 | `GET /deliverables/{deliverableId}` |
| DC-FR-26 | `POST /deliverables/{deliverableId}/draft-url` |
| DC-FR-14 | `POST /deliverables/{deliverableId}/items/{itemId}/ask` |
| DC-FR-15 | `DELETE /deliverables/{deliverableId}/items/{itemId}/ask` |
| DC-FR-09 | `POST /deliverables/{deliverableId}/check/retry` |
| DC-FR-31 | `GET /deals` |

Fields:

| For | Needs |
| --- | --- |
| DC-FR-01 | Deliverable `state` as one of the six states |
| DC-FR-03 | `checkStartedAt`; optional `estimatedSecondsLeft` |
| DC-FR-04 | `stages`: ordered list of `{ name, status }` |
| DC-FR-05 | Item `status` updated per item while the check runs, and a way to get updates (polling or push) |
| DC-FR-07 | `reviewWindowEndsAt` |
| DC-FR-08 | `checkFailure: { kind: "file", reason: "unreadable" \| "format" \| "too_long" \| "not_same_video" }` and `lengthCapSec` |
| DC-FR-09 | `checkFailure: { kind: "ours", retrying: boolean }`; a retry endpoint if not automatic |
| DC-FR-10, DC-FR-29 | `releasedAt`, `releaseReason: "deadline" \| "cancelled"`, `cancelledBy`, optional release reference |
| DC-FR-14, DC-FR-15 | Endpoints to ask the brand to accept an item and to withdraw an ask |
| DC-FR-16, DC-FR-17 | Item status `accepted_by_brand`; declined flag and `brandNote` |
| DC-FR-19 | `previousStatus` per item |
| DC-FR-23, DC-FR-26 | Short-lived video URL and an endpoint to refresh it; `aspectRatio` or platform and format |
| DC-FR-27 | Hold amount (minor units), currency, PayPal reference, held date, money stage, payout email |
| DC-FR-30 | `brief`: the deal's brief as numbered lines `{ number, text }[]`, matching each item's `briefLine.number` |
| Security | Every changing request (ask, withdraw, check retry, draft link, and upload when built) sends the session cookie, so it must be protected from cross-site requests: SameSite cookies and/or a CSRF token |
| DC-FR-44 | `deadline` stored as 23:59 in the creator's timezone, and `creatorTimeZone` (IANA name, e.g. "Africa/Lagos") |
| DC-FR-12 | `checkedBy: "person"` for items a person checks, such as Instagram's paid-partnership label (PRODUCT.md "Platforms") |
| DC-FR-31 | Deals list: deal id, brand name, current step and one-line status per deal |
| DC-FR-37 | Which deliverable's next step is the creator's |
| DC-FR-46 | Optional `fixHint` per Fix needed and Unsure item: one imperative sentence, at most 280 characters, plain text. Built by code for exact items (codes, links: "Show GLOW20 exactly, with a zero"), written by the AI for judgment items. Model output is validated against a schema like every model response; a missing or malformed hint is left out rather than guessed. It is guidance only and never affects the result. Built against the mock first (William's call); Furqaan can change it |
| DC-FR-33 | Each deal summary's `deliverables: { id, platform, state }[]`, so the switcher can name each deliverable and show its step |

## Testing Decisions

- Tests check what a creator sees and can do, not how components are built. Tests are named after the FR or BR they prove.
- **Deliverable view model:** every state in DC-FR-01, the next-step copy and action for each state, DC-FR-11 at 3 days and just over, DC-FR-19, DC-FR-20 counts, DC-FR-21 and DC-BR-01 to DC-BR-06.
- **Item status map:** every status has an icon and a word (never colour alone), Accepted by brand is never the pass colour, and each status sits in the right tab.
- **API client:** schema-invalid responses become errors; not-found and not-a-party give the same outcome; the video URL refreshes once on expiry and then reports failure.
- **Components:** each one with mocked API data, at 375 px and at desktop width. The ask-brand action appears only on Unsure items. DC-FR-46: the Suggested fix shows on Fix needed, Unsure, declined (after the brand's note) and Waiting for brand items, in the evidence panel and the expanded card, never on other statuses, never in the grid, and nothing at all when the hint is missing. The schema rejects a hint over 280 characters. The grid and the cards are tested for DC-FR-41 parity on the same fixture.
- **End to end (Playwright, on MSW):** every named mock scenario at 375 px and 1280 px, including selecting an item from the timeline, grid and card, Back through selection, asking and withdrawing, and the 9:16 deliverable.
- Coverage of at least 70% on components and lib code.
- There are no earlier tests in the repo; these are the first.

## Out of Scope

- The upload flow: picking the file, the YouTube unlisted link and the length cap prompt.
- The brand's side: the review screen, accepting or declining an ask, objections.
- Run history beyond the change since the last run.
- Steps 6 to 8: publish, re-confirming the hold, the live check and payout. The page hands off at fully passing.
- Payouts and Connected accounts pages.
- Sign-in, sign-out and the creator's account.
- Notifications.
- The backend: checks, timers, holds and every money movement.

## Open items

- **Furqaan to confirm** the `person` value for `checkedBy`.
- **The length cap** on uploads (and the upload count) is not set. It is an AWS cost limit, owned by Furqaan or both.
- **Upload draft action** (DC-FR-02, DC-FR-08): see DC-FR-45 until the upload flow's FRD is built.
- **API contract**: the provisional shape above becomes the agreed contract, or is revised to match it.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William | [Frontend stack](../decisions/2026-10-06-frontend-stack.md), [Evidence view AG Grid](../decisions/2026-10-06-evidence-view-ag-grid.md), [Design prototype first](../decisions/2026-10-06-design-prototype-first.md), [Frontend mocks with MSW](../decisions/2026-10-06-frontend-mocks-msw.md) |
| 1.0 | Signed by William | none |
| 1.1 | DC-FR-02, DC-FR-03: items checked only after publishing stay At live check before a draft and while a check runs; "Not checked yet" added to DC-FR-13. Found in the `/impeccable` pass | none |
| 1.1 signed | Revision 1.1 signed by William | none |
| 1.2 | Schema validation set to Zod; provisional API paths added to Requests for Furqaan. No requirement changes | [Schema validation with Zod](../decisions/2026-10-06-schema-validation-zod.md) |
| 1.2 signed | Revision 1.2 signed by William | none |
| 1.3 | DC-FR-44 added: deadlines are the end of the day in the creator's timezone, shown in that timezone (William's choice, Furqaan to confirm). `checkedBy` gains `person` for items a person checks. Requests for Furqaan updated | none |
| 1.3 signed | Revision 1.3 signed by William | none |
| 1.4 | Ask-the-brand and the deadline timezone recorded as William's decisions; the "wait for Furqaan" gate is removed (Furqaan can supersede). No requirement changes | [Creator asks brand to accept](../decisions/2026-10-06-creator-asks-brand-to-accept-unsure.md), [Deadline in creator's timezone](../decisions/2026-10-06-deadline-end-of-day-creator-timezone.md) |
| 1.4 signed | Revision 1.4 signed by William | none |
| 1.5 | DC-FR-44 rewritten: one shared date in the creator's timezone, plus the viewer's own time when it differs | [Deadline: shared date with local time](../decisions/2026-10-06-deadline-shared-date-with-local-time.md) |
| 1.5 signed | Revision 1.5 signed by William | none |
| 1.6 | DC-FR-30: View brief opens a read-only brief view, with `brief` added to Requests for Furqaan. DC-FR-45 added: mock-only upload while the upload flow is unspecced. Security request added: changing requests must be protected from cross-site requests | none |
| 1.6 signed | Revision 1.6 signed by William | none |
| 1.7 | Requests for Furqaan: deal summaries gain `deliverables` (id, platform, state) for the deliverable switcher (DC-FR-33). No requirement changes | none |
| 1.7 signed | Revision 1.7 signed by William | none |
| 1.8 | DC-FR-46 added: a Suggested fix line on Fix needed, Unsure and Waiting for brand items, from an optional `fixHint` (Requests for Furqaan). User stories 50 to 54. William's call to build against the mock first; Furqaan can change it | none |
| 1.8 signed | Revision 1.8 signed by William | none |
