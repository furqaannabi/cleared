# Confirm and hold: FRD

**Status:** Signed by William (revision 1.1).

**Surface:** Both sides of step 3 of [How a deal runs](../PRODUCT.md#how-a-deal-runs). **The brand's deal page:** the brand opens the creator's link, reads the terms and every checklist with where each item came from, asks for changes or agrees, then approves one PayPal hold per post. **The creator's side:** the brand's notes beside what they're about, "Send updated terms", and each post's hold as it comes in.

**Scope of this build:** frontend only, against provisional mocks (see [Mocks and the provisional contract](#mocks-and-the-provisional-contract)). Swapping the link for a session, versioning the terms, recording the agreement, every PayPal call and every money state run on the backend; the frontend starts actions and shows what the API returns. It never decides a money state. Requirements tagged **Depends on backend** name their fallback.

## Problem Statement

The brand gets a link from a creator it has already agreed a deal with in chat. Before money is reserved, it needs to see exactly what it's paying for: what each post must say and show, what the creator decided when the brief was unclear, and which lines of its own brief won't be checked. If something is wrong, it needs a way to say so that points at the problem, without starting over. Then it needs to reserve the money in a way that says plainly, at every moment, whether anything was taken.

The creator needs to know whose move it is: waiting for the brand, answering the brand's notes, or waiting for a hold, and which posts they can start on.

## Solution

The link opens a page for the brand, with no account. It shows the sponsorship terms read-only (the posts, deadlines in days after the hold, amounts, the total and the four payment rules) and each post's checklist. Every item quotes the brief line it came from, items the creator added are marked, items where the creator settled something unclear say how, and brief lines that didn't become an item are listed as "Not on the checklist".

The brand can "Ask for a change" on any item, line left out, amount or deadline, plus one note for the whole deal, and send the notes together. The creator sees each note beside what it's about, changes the terms, and sends them; the brand's same link then shows the new version with each change marked. When the brand is happy it taps "Agree to these terms" under a one-line summary. The agreement is recorded against that version, and one "Approve hold" per post appears. Each post's hold shows a plain state from the API, from "Approve with PayPal" to "Held" with its PayPal reference and the post's now-fixed deadline date.

## User Stories

**The brand**

1. As a brand, I want the creator's link to open the deal without making an account, so that I can review it straight away like an invoice.
2. As a brand, I want the link to stop appearing in my address bar once the deal opens, so that it doesn't sit in my history or leak to other sites.
3. As a brand, I want a link that no longer works to tell me to ask the creator for a new one, so that I know what to do.
4. As a brand, I want to see who invited me and for what, so that I know I'm in the right place.
5. As a brand, I want to see each post, its amount, its deadline and the total, so that I know what I'm being asked to approve.
6. As a brand, I want to see that the deadline counts from when I approve the hold, so that I know when the creator must post.
7. As a brand, I want to read the four rules of how the money moves, so that I know when it's reserved, taken or given back.
8. As a brand, I want to see that the creator is paid to their PayPal without seeing their email, so that I trust where the money goes.
9. As a brand, I want to see every checklist item for every post, so that I know what each video will be checked against.
10. As a brand, I want each item to quote the line of my brief it came from, so that I can see nothing was invented.
11. As a brand, I want items the creator added to be marked, so that I know they weren't in my brief.
12. As a brand, I want to see where the creator decided what an unclear line meant, so that I can disagree before money is held.
13. As a brand, I want to see which lines of my brief won't be checked, so that nothing I care about is dropped silently.
14. As a brand, I want to ask for a change on a specific item, so that the creator knows exactly what's wrong.
15. As a brand, I want to ask for a line that was left out to be checked, so that it goes on the checklist.
16. As a brand, I want to question an amount or a deadline, so that a typo doesn't become the deal.
17. As a brand, I want to leave one note about the deal as a whole, so that I can raise something that isn't on the page.
18. As a brand, I want to see, edit and remove my notes before I send them, so that I send what I mean.
19. As a brand, I want to send all my notes at once, so that the creator gets one clear list.
20. As a brand, I want to know what happens after I send notes, so that I'm not left wondering.
21. As a brand, I want the same link to show the updated terms with each change marked, so that I only re-check what changed.
22. As a brand, I want to see how each of my notes was answered, so that I know none was ignored.
23. As a brand, I want a one-line summary of what I'm agreeing to next to the button, so that I agree knowingly.
24. As a brand, I want to be warned if I'm about to agree with notes I haven't sent, so that I don't lose them.
25. As a brand, I want to be stopped if the creator changed the terms while I was reading, so that I never agree to a version I haven't seen.
26. As a brand, I want to approve one hold per post, so that a problem with one post doesn't block the others.
27. As a brand, I want to know that a hold reserves money and doesn't take it, so that I'm comfortable approving it.
28. As a brand, I want to be told plainly if I closed PayPal or PayPal declined, and that nothing was taken, so that I can try again.
29. As a brand, I want the page to stop me approving twice while PayPal is still answering, so that I'm never held twice.
30. As a brand, I want each held post to show its PayPal reference and the date the creator must post by, so that I have a record.
31. As a brand, I want to come back to the link later and see where the deal stands, so that I don't have to remember.
32. As a brand, I want to forward the link to a colleague who approves payments, so that the right person can approve the holds.

**The creator**

33. As a creator, I want the rail to show when the brand has asked for changes, so that I know it's my move.
34. As a creator, I want each of the brand's notes beside the item, line, amount or deadline it's about, so that I can act on it in place.
35. As a creator, I want to change the checklist and the terms in answer, and optionally reply to a note, so that the brand sees what I did.
36. As a creator, I want to send the updated terms to the same link, so that I don't have to send the brand a new one.
37. As a creator, I want the rail to show the brand has agreed and how many posts are held, so that I know where the money stands.
38. As a creator, I want each post not yet held to say why, so that I'm never left guessing.
39. As a creator, I want a held post to show its fixed deadline date and open its draft check, so that I can start on it.

**Both**

40. As a brand or creator on a phone, I want the pages to work at 375 px with 44 px targets, so that I can do this anywhere.
41. As a keyboard or screen-reader user, I want every control reachable and named, and changes of state announced, so that I can use the pages without a mouse.

## Functional requirements

### Opening the link

| ID | Requirement |
| --- | --- |
| CH-FR-01 | **Swap the token.** `/b/{token}` shows "Opening your deal…" while it asks the API to swap the token for a session (an HttpOnly cookie scoped to the deal; the frontend never sees it). On success it replaces the URL with `/brand/deals/{dealId}`, so the token leaves the address bar and history. **Depends on backend;** on mocks the session lives in the mock's memory. |
| CH-FR-02 | **A link that doesn't work.** Expired, turned off or unknown, the page says one thing: "This link doesn't work any more. Ask the creator who sent it for a new one." It names no creator or brand and gives no reason. |
| CH-FR-03 | **No session.** `/brand/deals/{dealId}` without a session for that deal says "Open the link {creator} sent you again." (or, when the API can't name the creator, "Open the link you were sent again."). It never offers sign-in. |

### The brand's page

| ID | Requirement |
| --- | --- |
| CH-FR-04 | **Frame.** A slim header: the Cleared logo and "{creator} invited {brand}". No rail and none of the creator's navigation. The page title is "{brand} × {creator}". |
| CH-FR-05 | **Terms, read-only.** The sponsorship terms sheet (IN-FR-04 to IN-FR-08's layout) with Creator and Brand, a line per post (the post, "Within {n} days of your hold", the amount), the total "held as one hold per post", "Paid to {creator}'s PayPal" (never the email, IN-BR-05), and the four payment rules worded for the brand: (1) "You approve a hold for each post. The money is reserved, not taken." (2) "{creator}'s draft is checked against the checklist. If every item passes, you have 48 hours to object. If you don't, it's approved. Anything that doesn't pass waits for {creator} to fix it or for you to accept it." (3) "{creator} posts by the deadline. Once the live post checks out, {creator} is paid." (4) "If {creator} misses the deadline, the hold comes back to you." |
| CH-FR-06 | **The checklist, per post.** Each post's checklist under its line, every item with its name. On phones each is folded ("6 items · View"); from `md:` it is open. Interpreted items (CH-FR-08) and "Not on the checklist" (CH-FR-09) are visible without unfolding. |
| CH-FR-07 | **Where an item came from.** Each item quotes its brief line ("From your brief: …"). An item the creator added says "Added by {creator}" instead. |
| CH-FR-08 | **What the creator decided.** Where the creator answered the AI's question about a line, the items from that line say: "You wrote "{line}". {creator} read it as "{answer}"." |
| CH-FR-09 | **Not on the checklist.** Brief lines that no item cites, including lines the creator chose to leave out, listed once for the deal under "Not on the checklist" with "These won't be checked." |

### Asking for changes

| ID | Requirement |
| --- | --- |
| CH-FR-10 | **Ask for a change.** Available, until the brand agrees, on every item, every line under "Not on the checklist", and every post's amount and deadline. It opens a note field in place (plain text, up to 500 characters). One more note, "Anything else about this deal?", covers the deal as a whole. |
| CH-FR-11 | **Notes before sending.** Each saved note shows beside what it's about, with Edit and Remove. A bar lists how many there are and "Send {n} changes to {creator}". **Depends on backend** for keeping unsent notes across devices; on mocks they're kept for the page's life. |
| CH-FR-12 | **Sent.** Sending moves the deal to `changes_requested`. The page then says "Sent to {creator}. When they update the terms, this page shows the new version. You can close it." with the notes listed, read-only. |
| CH-FR-13 | **The new version.** When the creator sends updated terms, the same link shows them as "Version {n}", each changed item, line, amount or deadline marked "Changed" (plain text), and each of the brand's notes under "Your notes" with the creator's reply, if any. |

### Agreeing

| ID | Requirement |
| --- | --- |
| CH-FR-14 | **Agree.** Above the button, one line: "You're agreeing to the checklist for {n} posts, {total} in total (one hold per post), and how payment works." The button is "Agree to these terms". If the brand has notes not yet sent, it reads "Agree without sending your {n} notes?" and the notes are discarded on agreeing. |
| CH-FR-15 | **Out-of-date version.** Agreeing sends the version shown. If the API refuses it as out of date, the page reloads the terms and says "{creator} updated the terms. Check the changes before agreeing." |
| CH-FR-16 | **Agreed.** The page says "Agreed · version {n} · {date}"; "Ask for a change" and the button are gone for good, and the holds appear (CH-FR-17). |

### Holds

| ID | Requirement |
| --- | --- |
| CH-FR-17 | **One hold per post.** After agreeing, each post's line gains its hold: "{post} · {amount}" and "Approve with PayPal". Each post is approved on its own. Above them: "{held} of {n} held". **Depends on backend;** on mocks a plain stand-in button calls the mock and nothing reaches PayPal. |
| CH-FR-18 | **Hold states,** each from the API, on that post's line: closed ("You closed PayPal. Nothing was held." and the button back); declined ("PayPal didn't approve this hold. Nothing was taken. Try again, or pick another way to pay in PayPal."); pending ("Checking with PayPal…", button off, the page asks the API again); unknown after that ("We couldn't confirm this with PayPal yet. Don't approve it again; this page will update."); held ("Held · {amount} · PayPal ref {reference}" and "{creator} posts by {date}"). "Held" is plain ink, never green. |
| CH-FR-19 | **All held.** "All held. {creator} is making the posts." with each post's deadline date. Nothing on the page asks the brand for anything more in this step. |
| CH-FR-20 | **Coming back.** While the session lasts, opening `/brand/deals/{dealId}` shows the deal as it stands: waiting for the creator's changes, agreed with holds, or all held. Agreement and holds already done are never offered again. Several people with the link each get their own session and see the same state. |

### The creator's side

| ID | Requirement |
| --- | --- |
| CH-FR-21 | **Steps and the rail.** The deal's `step` gains `changes_requested` and `agreed`. The rail shows "{brand} · Changes asked", "{brand} · Agreed · {held} of {n} held". `/deals/{id}` opens the invite page at both; once every post is held the deal leaves set-up and routes per DC-FR-37. |
| CH-FR-22 | **The notes, in place.** At `changes_requested` the invite page leads with "{brand} asked for {n} changes", each note beside its post, amount or deadline, and the checklist page shows each note beside its item or brief line. Notes about the deal as a whole sit at the top of both. The terms are editable again and "Edit checklist" works (IN-FR-03); the brand's link stays on (CH-BR-04). |
| CH-FR-23 | **Reply.** Each note has an optional reply (plain text, up to 500 characters), shown to the brand with the note (CH-FR-13). |
| CH-FR-24 | **Send updated terms.** In place of "Create link", "Send updated terms to {brand}" is gated like IN-FR-16. It saves a new version, moves the deal back to `waiting_for_brand`, restarts the link's expiry, and, if a brand email is set, Cleared emails the brand that the terms changed. The page then shows the link view (IN-FR-17) with "Version {n} sent". |
| CH-FR-25 | **Holds, for the creator.** At `agreed` the invite page shows each post's hold: held posts show "Held · {amount} · PayPal ref {reference}", "Post by {date}" and "Open draft check"; a post not held yet says "Waiting for {brand} to approve this hold. You can start on the posts that are held." |

### Responsive and accessibility

| ID | Requirement |
| --- | --- |
| CH-FR-26 | Mobile-first at 375 px (the brand's page designed at 390 px first): one column, every target at least 44 px, note fields full width, no sideways page scroll. From `lg:` the agree summary and holds may sit beside the terms. |
| CH-FR-27 | Every control is reachable by keyboard and named; "Ask for a change" says what it's for ("Ask for a change to {item}"); sending notes, agreeing, version conflicts and each hold state are announced politely; reduced motion is respected. |

## Business rules

| ID | Rule |
| --- | --- |
| CH-BR-01 | The brand never edits the terms; it asks, and the creator changes them ([decision](../decisions/2026-10-08-brand-asks-for-changes-not-edits.md)). The brand only ever agrees to terms the creator wrote (IN-BR-03). |
| CH-BR-02 | Agreement is recorded against one version of the terms. A version the brand hasn't been shown can't be agreed to. Once agreed, the terms are final for this step. |
| CH-BR-03 | No hold before agreement. One hold per post, each approved, failed and retried on its own. A post's deadline date is fixed when its hold is approved (IN-BR-01). |
| CH-BR-04 | A change request keeps the link on; sending updated terms restarts its expiry. The creator's own "Change terms" (IN-FR-19) and "Make a new link" (IN-FR-18) still turn it off. |
| CH-BR-05 | The page shows "Held" only when the API says so, and never offers to approve a hold that is pending or unknown. The frontend decides no money state and calls no PayPal endpoint itself beyond starting the approval. |
| CH-BR-06 | The token is never stored (no localStorage or sessionStorage), logged or kept in the URL after the swap ([decision](../decisions/2026-10-08-brand-access-by-link-session.md)). A link that doesn't work shows one message that names no one and gives no reason. |
| CH-BR-07 | Notes and replies are untrusted plain text: shown as text, never as HTML or links, never acted on. They change nothing until the creator changes the terms. |
| CH-BR-08 | The brand never sees the creator's PayPal email (IN-BR-05). |

## Implementation Decisions

- **Routes:** `/b/[token]` (the swap, no shell) and `/brand/deals/[dealId]` (the brand frame, no rail). The creator's pages stay where they are: the invite page and checklist page gain the notes and the hold lines.
- **Modules:** a pure **terms view for the brand**, turning the deal's terms, checklist, brief lines and questions into posts with their items, each item's source (brief line, added, or interpreted with the answer), the lines not on the checklist, the changes since the last version, and the agree summary; tested on its own. A pure **hold view**, turning each post's hold state from the API into its text, whether the button is on, and "{held} of {n} held". Components in a `brand-deal/` feature folder, each under ~200 lines; the terms sheet's rules and lines are shared with the invite page, worded per side.
- **Data:** Zod schemas for the provisional API; the typed client gains the brand calls (swap, read, notes, agree, approve hold, hold status) and the creator calls (read notes, reply, send updated terms). MSW handlers keep the session, versions, notes, agreement and holds in memory.
- **Mocks:** the seed gains a demo deal at `waiting_for_brand` with a working demo link. In mock builds only, the creator's link panel shows "Open as {brand}", so both sides can be clicked through in one browser; like every fixture, it never reaches a production build. The demo PayPal stand-in can be told to close, decline, stay pending or hold, so every state in CH-FR-18 can be shown.
- **Visual:** inherits DESIGN.md. Rendered mockups in `design/brand-deal/` before build, at 390 px and desktop; William picks.

## Mocks and the provisional contract

```ts
interface BrandDeal {
  dealId: string;
  creatorName: string;
  brandName: string;
  step: "waiting_for_brand" | "changes_requested" | "agreed";
  version: number;
  agreedAt?: string;               // ISO date-time
  posts: {
    deliverableId: string;
    platform: "youtube_video" | "youtube_short" | "instagram_reel";
    amount: string;                // "1200.00", USD
    deadlineDays: number;          // 1–21, after the hold
    changed?: ("amount" | "deadline")[];
    hold: {
      state: "not_started" | "closed" | "declined" | "pending" | "unknown" | "held";
      reference?: string;          // PayPal reference, when held
      deadline?: string;           // ISO date, fixed when held
    };
  }[];
  items: { id: string; deliverableId: string; name: string; briefLine?: number; addedByCreator: boolean; changed?: boolean }[];
  brief: { number: number; text: string }[];
  answers: { briefLine: number; kind: "suggestion" | "own_words" | "left_out"; text?: string }[];
  notes: {
    id: string;
    about: { kind: "item"; itemId: string } | { kind: "line"; briefLine: number } | { kind: "amount" | "deadline"; deliverableId: string } | { kind: "deal" };
    text: string;                  // ≤ 500, plain text
    reply?: string;                // the creator's, ≤ 500
    version: number;               // the version it was written on
  }[];
}
```

The creator's deal summary and invite gain `step: "changes_requested" | "agreed"`, the notes, and each post's hold as above.

### Requests for Furqaan

| For | Needs |
| --- | --- |
| CH-FR-01, CH-FR-03 | `POST /b/{token}/session`: swaps a valid token for an HttpOnly, deal-scoped session cookie and returns the deal id; every brand route checks the session belongs to that deal |
| CH-FR-02 | One response for expired, turned off and unknown tokens |
| CH-FR-04 to CH-FR-09 | `GET /brand/deals/{id}`: the shape above, without the creator's PayPal email or account details |
| CH-FR-10 to CH-FR-12 | `POST /brand/deals/{id}/notes` (the set, sent together); `step` becomes `changes_requested` |
| CH-FR-13, CH-FR-24 | Terms versions: each send makes a new version; what changed between versions per item, amount and deadline |
| CH-FR-14 to CH-FR-16 | `POST /brand/deals/{id}/agree` with the version; refuses an out-of-date version; `step` becomes `agreed` |
| CH-FR-17 | `POST /brand/deals/{id}/posts/{deliverableId}/hold`: creates the PayPal order and returns `{ orderId }` for the approval step; refused before the brand agrees, for a held post, and while a hold is pending or unknown. `PayPal-Request-Id` on every create |
| CH-FR-18 | `POST …/hold/approved` with `{ orderId }`: PayPal approved, so the API authorizes and returns the deal with the hold's state (`held` with reference and deadline, `declined`, `pending` or `unknown`). `POST …/hold/closed` with `{ orderId }`: the brand closed PayPal; the hold is `closed`. Both refuse an order id from another post |
| CH-FR-17, CH-FR-18 | The PayPal JS SDK wiring for the approval step (the page calls the two endpoints above from its approve and cancel callbacks) |
| Mocks only | `POST /__demo/paypal/next` with `{ outcome }` sets the Demo PayPal's next answer. It exists only in the MSW mocks and is never part of the real API |
| CH-FR-19, CH-FR-21 | When every post is held, the deal leaves set-up; the deal summary's `openDeliverableId` per DC-FR-37 |
| CH-FR-22, CH-FR-23 | Notes on the creator's invite and checklist; `PUT /deals/{id}/notes/{noteId}/reply` |
| CH-FR-24 | `POST /deals/{id}/invite/send`: new version, `waiting_for_brand`, link expiry restarted; email to the brand that the terms changed (SES, as IN-FR-13) |
| CH-BR-03 | Each post's deadline date fixed at its own hold |

## Testing Decisions

- Tests check what the brand and creator see and can do, named after the CH-FR they prove.
- **Terms view:** an item's source (brief line, added, interpreted with the answer); lines no item cites listed once; changes since the last version; the agree summary's count and total; never includes the PayPal email.
- **Hold view:** each state's text and whether the button is on; "Held" only for `held`; "{held} of {n} held".
- **Components:** the swap and the URL replaced; the one bad-link message; the terms read-only with the brand's rules; folding on phones; Ask for a change on each kind, edit and remove, send; the sent state; version marks and replies; Agree with and without unsent notes; out-of-date refusal; each hold state; coming back. Creator side: notes beside their targets, reply, Send updated terms gated, hold lines and "Open draft check".
- **End to end (Playwright, on MSW):** creator creates the link → opens it as the brand → asks for a change on an item and an amount → creator replies, changes and sends → the brand sees "Changed", agrees → approves both holds (one declined first, then held) → the creator's rail shows "All held" routing on. At 375 px and 1280 px; the token is absent from the URL after the swap.

## Out of Scope

- Cancelling a deal, or a time limit for a brand that agrees but never approves a hold (no money is held, so no deadline runs).
- Telling the creator the brand has opened the link.
- Real PayPal JS SDK wiring and PayPal's branded button (a stand-in on mocks; see Requests for Furqaan).
- Real email sending.
- An emailed code or a brand account (the [decision](../decisions/2026-10-08-brand-access-by-link-session.md) leaves room for a code later).
- Step 5 onward: the brand's review window, objections and accepting Unsure items.

## Open items

- **A brand that agrees and never approves a hold:** what happens to the deal, and when. A product decision for William and Furqaan.
- **Link expiry length:** still 7 days assumed (IN-FR-17).

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: the brand asks for changes and the creator makes them; the link is swapped for a deal-scoped session and a clean URL; agreeing comes before the holds and is final; one PayPal approval per post; the brand sees each item's brief line, the creator's interpretations and the lines not on the checklist; notes on items, lines left out, amounts, deadlines and the deal; the link stays on through a change request and the terms are versioned; one message for a link that doesn't work; the creator sees only the brand's actions; a plain hold state per post; one Agree button under a summary | [Brand asks for changes](../decisions/2026-10-08-brand-asks-for-changes-not-edits.md), [Brand access by link session](../decisions/2026-10-08-brand-access-by-link-session.md) |
| 1.0 | Signed by William | none |
| 1.1 | Requests for Furqaan: the hold call split into start (returns the PayPal order id), approved and closed, as built against the mocks; the mock-only Demo PayPal endpoint noted. No requirement changes | none |
| 1.1 | Signed by William | none |
