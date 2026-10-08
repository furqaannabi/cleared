# Creator invite: FRD

**Status:** Signed by William (revision 1.2).

**Surface:** Creator app. Step 2 of [How a deal runs](../PRODUCT.md#how-a-deal-runs): once the checklist is ready, the creator sets the amount and deadline for each post, connects the YouTube or Instagram account the posts go on, gives the PayPal email to be paid at, and sends the brand a link. The brand's side of the link (confirm the checklist, approve the hold) is the next surface.

**Scope of this build:** frontend only, against provisional mocks (see [Mocks and the provisional contract](#mocks-and-the-provisional-contract)). Signing in with Google or Instagram, storing tokens, making and expiring links, and sending email all run on the backend; the frontend shows what the API returns. Requirements tagged **Depends on backend** name their fallback.

## Problem Statement

A creator and a brand agree a fee in a chat, and that's the last time the money is written down. The brand doesn't know when it will be asked to pay or what for; the creator doesn't know when they'll be paid, to which account, or what happens if they're late. Nothing ties the fee to the checklist the content is judged against, so each side can later remember the deal differently.

## Solution

An invite page that comes straight after "Checklist ready". For each post the creator sets an amount and a deadline (a number of days after the brand approves the hold), connects the account the post goes on, and gives the PayPal email to be paid at. The page states the four rules of how the money moves, in plain words. "Create link" locks those terms into one link for the brand, which the creator copies or shares (and, optionally, Cleared emails to the brand). Changing anything later turns the old link off and makes a new one, so the brand can only ever approve the terms the creator set.

## User Stories

1. As a creator, I want to go from a ready checklist straight to setting the money, so that the deal keeps moving.
2. As a creator, I want to set an amount for each post, so that each post is paid on its own.
3. As a creator, I want to see the deal's total and that it's held as one hold per post, so that I know what the brand will be asked to approve.
4. As a creator, I want to set each post's deadline as days after the brand approves the hold, so that the deadline can't be broken by the brand taking a while.
5. As a creator, I want an example date for each deadline, so that "14 days" means something concrete.
6. As a creator, I want to be told I can't go past 21 days, and why, so that I don't promise a date Cleared can't hold money for.
7. As a creator, I want to connect only the accounts my posts need, so that I don't hand over access I don't have to.
8. As a creator on Instagram, I want to know up front that I need a professional account, so that I'm not surprised at the end.
9. As a creator, I want an account I've connected before to stay connected on new deals, so that I do it once.
10. As a creator, I want my PayPal email filled in from last time, so that I don't retype it.
11. As a creator, I want to be warned that a payout to the wrong email can't be pulled back, so that I check it.
12. As a creator, I want the brand never to see my PayPal email, so that my details stay mine.
13. As a creator, I want to see the rules of how I get paid before I invite the brand, so that we agree to the same thing.
14. As a creator, I want everything I type saved as I go, so that I can leave and come back.
15. As a creator, I want a failed save shown beside the field with Try again, so that I never think something is saved when it isn't.
16. As a creator, I want "Create link" to tell me what's still missing, so that I know what to do next.
17. As a creator, I want to copy the link, or share it from my phone, so that I can send it the way I already talk to the brand.
18. As a creator, I want Cleared to email the link to the brand if I give their email, so that it reaches the right person and they hear from Cleared again later.
19. As a creator, I want to know the link expires and who can open it, so that I send it carefully.
20. As a creator, I want to make a new link if I sent it to the wrong person or it expired, so that the old one stops working.
21. As a creator, I want to change the terms after sending, knowing the old link stops working, so that the brand can't approve terms I've changed.
22. As a creator, I want to go back and fix the checklist before I create the link, so that a mistake doesn't mean starting again.
23. As a creator, I want the rail to show the deal waiting for the brand, so that I know whose move it is.
24. As a creator on a phone, I want the page to work at 375 px with 44 px targets, so that I can do this anywhere.
25. As a creator using a keyboard or screen reader, I want every control reachable and named, and errors announced, so that I can use the page without a mouse.

## Functional requirements

### Getting here

| ID | Requirement |
| --- | --- |
| IN-FR-01 | **From the checklist.** After "Checklist ready" (BC-FR-17), the checklist page's message gains "Set amounts and invite {brand}", which opens `/deals/{id}/invite`. |
| IN-FR-02 | **Routing.** `/deals/{id}` opens the invite page while the deal's step is `invite` or `waiting_for_brand`. The rail shows the deal as "{brand} · Invite", then "{brand} · Waiting for brand". |
| IN-FR-03 | **The checklist, folded.** The page shows each post's checklist folded ("5 items · View"), read-only. Until the link exists, "Edit checklist" moves the deal back to step `checklist` through the API and opens the checklist page; amounts, deadlines and emails already entered are kept. |

### Each post

| ID | Requirement |
| --- | --- |
| IN-FR-04 | **One block per deliverable,** named as on the checklist ("YouTube video", "Instagram Reel"), each with its amount and deadline. |
| IN-FR-05 | **Amount.** In US dollars, shown with "$"; no currency choice. Accepts more than $0, at most two decimal places, up to $9,999,999.99. Anything else is explained beside the field ("Enter an amount in dollars, like 1200 or 1200.50"). Sent to the API as a decimal string (`"1200.00"`), never a number. Cleared sets no other ceiling. |
| IN-FR-06 | **PayPal's limit. Depends on backend.** If the API turns an amount down (for example, above what one PayPal hold can be), its reason is shown beside that post's amount. Fallback: none needed; the mock never refuses a valid amount. |
| IN-FR-07 | **Deadline in days.** "Post within {n} days of {brand} approving the hold", 1 to 21 days, with a number field and − / + buttons. Above 21 it says "Up to 21 days. PayPal only holds money for 29 days, so Cleared keeps a margin." Below it shows an example: "If {brand} approves today, that's {date}." |
| IN-FR-08 | **Total.** Under the posts: "Total for this deal: ${sum}, held as one hold per post." Shown only when every amount is valid. |

### Your accounts

| ID | Requirement |
| --- | --- |
| IN-FR-09 | **Only what the posts need.** A YouTube card if any post is a YouTube video or Short; an Instagram card if any post is a Reel. |
| IN-FR-10 | **Connected.** A connected card shows the account's name and "Connected". Accounts belong to the creator, so one connected on an earlier deal shows connected here. |
| IN-FR-11 | **Connect. Depends on backend.** "Connect YouTube" (Google sign-in, read-only) or "Connect Instagram" (Instagram sign-in). The Instagram card says "Professional accounts only" before connecting. If the API reports the account isn't professional, the card says so and how to switch. Fallback (mocks): connecting succeeds at once with a synthetic account; no real sign-in. |

### Payment

| ID | Requirement |
| --- | --- |
| IN-FR-12 | **PayPal email.** "Your PayPal email", filled from the creator's profile if they've given one before. Must look like an email. Under it: "We send your payment here. Check it: a payment to the wrong email can't be pulled back." Saving it here updates the profile. |
| IN-FR-13 | **The brand's email (optional).** "{brand}'s email (optional)". If given, Cleared also emails the link to it when the link is created. Must look like an email if filled. |
| IN-FR-14 | **How you'll be paid.** A fixed block, four lines, not editable: (1) "{brand} approves a hold for each post. The money is reserved, not taken." (2) "Your draft is checked against the checklist. If every item passes, {brand} has 48 hours to object. If they don't, it's approved. Anything that doesn't pass waits for you to fix it or for {brand} to accept it." (3) "Post by the deadline. Once the live post checks out, you're paid to your PayPal." (4) "Miss the deadline, and the hold goes back to {brand}." |

### Saving and the link

| ID | Requirement |
| --- | --- |
| IN-FR-15 | **Saved as you go.** Each amount, deadline and email saves through the API when it changes (on blur, or on − / +). A failed save says so beside the field with Try again, and is never shown as saved. Leaving and coming back shows what was saved. |
| IN-FR-16 | **Create link.** "Create link for {brand}" is available when every post has a valid amount and deadline, every needed account is connected, and the PayPal email is valid. Until then it says the first thing left ("Add an amount for the Instagram Reel", "Connect Instagram", "Add your PayPal email") and how many more. Above the button, a one-line summary repeats the total and the PayPal email. |
| IN-FR-17 | **Link created.** Creating the link saves the terms through the API and moves the deal to `waiting_for_brand`. The page then shows the terms read-only and the link with: Copy link ("Copied" for 2 seconds, announced), Share (the phone's share sheet, where the browser has one), "Anyone with this link can open this deal. Send it only to {brand}.", and when it expires ("Expires on {date}"). If a brand email was given: "We've also emailed it to {email}." |
| IN-FR-18 | **Make a new link.** Turns the current link off and shows a new one, after a confirm: "The old link will stop working." |
| IN-FR-19 | **Change terms.** Turns the link off, after a confirm ("{brand}'s link will stop working. You'll make a new one when you're done."), moves the deal back to `invite`, and makes the terms editable again. "Edit checklist" is available again too. |
| IN-FR-20 | **Expired.** If the API reports the link expired, the page says "This link has expired" with "Make a new link". |

### Responsive and accessibility

| ID | Requirement |
| --- | --- |
| IN-FR-21 | Mobile-first at 375 px: one column, the − / + buttons and every other target at least 44 px, number fields open the numeric keypad, no sideways page scroll. From `lg:` up the summary and "Create link" may sit beside the form. |
| IN-FR-22 | Every control is reachable by keyboard and named; field errors are tied to their fields and announced; save failures and "Copied" are announced politely; reduced motion is respected. |

## Business rules

| ID | Rule |
| --- | --- |
| IN-BR-01 | A deadline is a number of days after the hold, 1 to 21. Its date is fixed when the brand approves the hold, never before (PRODUCT.md: deadlines are capped at 21 days after the hold). |
| IN-BR-02 | Amounts are US dollars, as decimal strings with two places; never floats. One hold per post, for that post's amount. |
| IN-BR-03 | A link carries one set of terms: the checklist, the amounts, the deadlines and the payment rules. Any change to them turns the link off; the brand can only approve the terms the creator set. |
| IN-BR-04 | The link is unguessable, scoped to this deal, and expiring (CLAUDE.md "Invite links"). The frontend never stores it (no localStorage) or logs it; it always comes from the API. |
| IN-BR-05 | The creator's PayPal email is shown only to the creator. The brand sees "Paid to the creator's PayPal". |
| IN-BR-06 | The four payment rules (IN-FR-14) are fixed in v1. Nothing on this page changes the review window or what silence clears. |
| IN-BR-07 | The link can't be created until every account the posts need is connected. |

## Implementation Decisions

- **Route:** `/deals/{id}/invite`, inside the app shell. The deal's `step` gains `waiting_for_brand`; `dealHref` sends `invite` and `waiting_for_brand` deals here.
- **Modules:** a pure **invite view model** (each post's amount and deadline checks, the example date, the total, which accounts are needed, what's left before "Create link" and how many more), tested on its own; an amount parser that turns typed text into a two-place decimal string or an error, with no floats; components in an `invite/` feature folder, each under ~200 lines.
- **Data:** Zod schemas for the provisional API; the typed client gains the invite calls; MSW handlers keep invite terms per deal, a creator profile (PayPal email, connected accounts), and link state in memory. The demo creator starts with YouTube connected and Instagram not, so both states can be shown. The mocks also seed one demo deal already at the invite step ("Pine & Co": a YouTube video and an Instagram Reel, checklist ready, amounts and deadlines blank), so the invite page is one click from the rail after any reload; like every fixture, it never reaches a production build.
- **The link in mocks:** a synthetic, clearly fake URL (`/b/demo-…`) that opens nothing until the brand's page exists. Nothing real is generated in the browser.
- **Visual:** inherits DESIGN.md. Rendered mockups in `design/invite/` before build; William picks.
- **Checklist page:** BC-FR-17's message gains the IN-FR-01 button; that page is otherwise unchanged.

## Mocks and the provisional contract

```ts
interface DealInvite {
  dealId: string;
  step: "invite" | "waiting_for_brand";
  posts: {
    deliverableId: string;
    platform: "youtube_video" | "youtube_short" | "instagram_reel";
    amount?: string;        // "1200.00", USD
    deadlineDays?: number;  // 1–21, after the hold
    amountProblem?: string; // the API's reason it turned an amount down
  }[];
  brandEmail?: string;
  link?: { url: string; expiresAt: string; emailedTo?: string; expired: boolean };
}
interface CreatorProfile {
  paypalEmail?: string;
  accounts: { platform: "youtube" | "instagram"; name: string }[]; // connected only
}
```

### Requests for Furqaan

| For | Needs |
| --- | --- |
| IN-FR-02 | Deal `step` gains `waiting_for_brand` |
| IN-FR-03 | `POST /deals/{id}/checklist/reopen`: back to `checklist`, keeping invite terms |
| IN-FR-05, IN-FR-15 | `PATCH /deals/{id}/invite/posts/{deliverableId}` with `amount` (decimal string) and/or `deadlineDays`; `PATCH /deals/{id}/invite` with `brandEmail` |
| IN-FR-06 | The most one PayPal hold can be in the sandbox, if PayPal sets one, and the error the API returns for it |
| IN-FR-10, IN-FR-11 | `GET /me` with connected accounts; the Cognito / Google (read-only) / Instagram connect flow and its return route; a "not a professional account" error |
| IN-FR-12 | `PUT /me/paypal-email`; whether to verify the email with PayPal later (PayPal holds payouts to emails with no account as unclaimed) |
| IN-FR-13 | Emailing the link to the brand. Needs a sending service (Amazon SES fits the stack; it starts in a sandbox that only sends to verified addresses). The review window (48 hours, silence clears a passing draft) will need the same service to tell the brand a draft is ready |
| IN-FR-17 | `POST /deals/{id}/invite/link`: locks the terms, returns the link and its expiry, `step` becomes `waiting_for_brand`. The frontend assumes links expire after 7 days; Furqaan sets the real length |
| IN-FR-18 | `POST /deals/{id}/invite/link/renew`: turns the old link off, returns a new one |
| IN-FR-19 | `DELETE /deals/{id}/invite/link`: turns the link off, `step` back to `invite` |
| IN-BR-01 | Store `deadlineDays`; set the deadline date when the hold is approved |

## Testing Decisions

- Tests check what the creator sees and can do, named after the IN-FR they prove.
- **Amount parser:** whole and two-place amounts become decimal strings; zero, negative, three places, letters and over the bound are refused with the right message; never goes through a float.
- **Invite view model:** needed accounts per platform mix; the deadline bound and example date; the total only when every amount is valid; "what's left" in order with the count.
- **Components:** amount and deadline entry and errors; − / + at 1 and 21; connect (mocked) and the professional-account message; PayPal email prefill and warning; brand email optional; a failed save beside its field; Create link gated, then the link view with Copy, Share, expiry, emailed-to; Make a new link and Change terms confirms; Edit checklist going back.
- **End to end (Playwright, on MSW):** checklist ready → invite → amounts, deadlines, connect Instagram, PayPal email → Create link → copy; the rail shows "Waiting for brand"; Change terms back to editing. At 375 px and 1280 px.

## Out of Scope

- Cancelling or deleting a deal before the brand accepts. No money is held yet; a later revision decides it.
- Showing whether the brand has opened the link (the brand's deal page).
- The brand's side: confirming the checklist and approving the hold.
- Real sign-in with Google or Instagram, real email sending, and PayPal's real amount limit (mocked; see Requests for Furqaan).
- Fees, tax, and currencies other than US dollars.
- Disconnecting an account.

## Open items

- **Link expiry length:** 7 days assumed until Furqaan sets it (IN-FR-17).
- **Verifying the PayPal email** with PayPal: not in v1 (IN-FR-12).

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: own invite page; deadlines as days after the hold (1–21); US dollars as decimal strings with no Cleared ceiling; connecting the needed accounts required before the link; PayPal email on the profile, never shown to the brand; optional brand email that Cleared emails the link to; the four payment rules shown, fixed; saved as you go; changing terms turns the link off; back to the checklist until the link exists | none |
| 1.0 | Signed by William | none |
| 1.1 | A seeded demo deal at the invite step in the mocks ("Pine & Co"), so the page can be reached without redoing the brief after a reload | none |
| 1.1 | Signed by William | none |
| 1.2 | A brand's change request keeps the link on and the terms are versioned; the invite page shows the brand's notes and "Send updated terms", and each post's hold once the brand agrees (CH-FR-21 to CH-FR-25, CH-BR-04). The creator's own Change terms and Make a new link still turn the link off. Specified in [Confirm and hold](confirm-and-hold-frd.md) | [Brand asks for changes](../decisions/2026-10-08-brand-asks-for-changes-not-edits.md) |
| 1.2 | Signed by William, with Confirm and hold 1.0 | none |
