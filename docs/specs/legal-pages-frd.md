# Legal pages: FRD

**Status:** Signed by William (revision 1.2).

**Surface:** Three reading pages for anyone, signed in or not: the privacy policy at `/privacy`, the terms at `/terms`, and the data-deletion instructions at `/data-deletion`. Linked from the landing page's footer, the sign-in page, Settings, and the brand's deal and review pages.

**Scope of this build:** frontend only. The pages are static: no API calls, no cookies of their own. Every statement on them traces to a signed spec, PRODUCT.md or an ADR (the "Source" column below); nothing is promised that the backend doesn't do. Entering the URLs in Google's OAuth consent screen and Meta's app settings is William's or Furqaan's to do, not the agent's.

## Problem Statement

Sponing signs creators in with Google, reads their YouTube and Instagram accounts, holds unpublished drafts, and handles PayPal emails and references. Google's consent screen needs a privacy policy link; Instagram Login needs a privacy policy and a data-deletion instructions link. Neither creators nor brands can read what Sponing collects, why, who processes it, how to delete it, or the rules the money follows.

## Solution

Three plain pages in one reading layout, written from what Sponing actually does, each saying it was written for this hackathon project and not reviewed by a lawyer. The privacy policy says what is collected, why, who processes it and how long it is kept; the terms set out the deal and money rules; the data-deletion page says how to delete an account and what is kept afterwards.

## User Stories

1. As a creator about to sign in, I want to read what Sponing will do with my Google account, so that I can decide to sign in.
2. As a creator, I want to know exactly what Sponing reads from YouTube and Instagram, so that I trust the connection.
3. As a creator, I want to know who else handles my data (PayPal, AWS, Google, Meta, Resend, Vercel), so that I know where it goes.
4. As a creator, I want to know how long my drafts and records are kept, so that I know when they're gone.
5. As a creator, I want to know how to delete my account and what is kept afterwards, so that I can leave cleanly.
6. As a brand, I want to read the rules the held money follows before I approve a hold, so that I know when it's taken or given back.
7. As a brand, I want to know what Sponing keeps about me (my email, my PayPal references), so that I'm not surprised.
8. As either side, I want to know Sponing isn't a party to our agreement and isn't a marketplace, so that I know what it does and doesn't do.
9. As either side, I want to know this is a sandbox project where no real money moves, so that nobody mistakes it for a live service.
10. As a reader on a phone, I want the pages easy to read with my thumb, so that I can check them anywhere.
11. As a Google or Meta reviewer, I want stable URLs with specific answers, so that the app's settings point somewhere real.

## Requirements

### The layout

| ID | Requirement |
| --- | --- |
| LG-FR-01 | **One reading layout.** The landing page's header and footer (LP-FR-01, LP-FR-12), then the page title in Bricolage, "Last updated {date}" under it in ink-3, a line "Written for the Sponing hackathon project. Not reviewed by a lawyer.", and the sections. Body in Figtree at a measure of about 70 characters on the light ground. |
| LG-FR-02 | **Sections listed first.** A list of the page's sections, each linking to its heading. From `lg:` it sits in a sticky left column beside the text; on phones it is one column above the text. Each section heading has an anchor id. |
| LG-FR-03 | **Static and the same for everyone.** Server Components, no API calls, no client script of their own. Readable without signing in. |
| LG-FR-04 | **Contact.** Each page ends with "Questions or requests: williamikeji@gmail.com" as a mailto link. |

### The privacy policy (`/privacy`)

| ID | Requirement |
| --- | --- |
| LG-FR-05 | **What we collect, why, and the source of each.** Creators: name and email from Google sign-in (to sign in; SI); read-only access to their YouTube channel and, if connected, their Instagram professional account, with the account's name (to check the published post; DC, PP, IG); the drafts they upload, and the transcript, on-screen text and frames read from them (to check the draft against the checklist; DR); the brief they paste (to build the checklist; BC); their PayPal email (to pay them; IN). Brands: the email they choose to give (for the two notices after a post is live; the email ADRs), and the PayPal references of their holds (MP). Both: the deal's terms, checklist, notes and decisions, and the PayPal references for every hold, capture and payout (MP). |
| LG-FR-06 | **What we never do.** Never see or store a Google, Instagram or PayPal password; never post, edit or delete anything on YouTube or Instagram (read-only scopes); never sell data or show ads; never let an AI move money (PRODUCT.md rules). Tokens are encrypted at rest and never sent to the browser; drafts are private and shown only to the two sides of their deal through short-lived links (CLAUDE.md security rules). |
| LG-FR-07 | **Who processes it.** PayPal (holds, capture, payouts; sandbox only), Amazon Web Services (hosting, database, file storage, encryption, and Amazon Bedrock for reading briefs and checking drafts), Google (sign-in and YouTube), Meta (Instagram), Resend (the brand's two emails), Vercel (hosting the web app). Each named once, with what it is used for. (1.1) Confirmed by Furqaan (AH 1.0): the list is right, and the backend sends errors to no monitoring service. |
| LG-FR-08 | **How long it is kept.** Drafts after a deal ends; transcripts and check results; payment records; account data after deleting; server logs. Each period is Furqaan's answer (Requests below); until all are answered the page is not linked (LG-FR-14). (1.1) The periods, from AH-FR-24: drafts, and the speech, on-screen text and frames read from them, "30 days after the post ends (paid, its hold returned, or closed)"; a live Reel's fetched video, "only until it's matched to your draft, a few minutes"; the brief, checklist, notes, check results and evidence, and the brand's email, "while your account exists"; access to YouTube and Instagram, "until you disconnect, access ends, or you delete your account"; payment records, "for as long as Sponing runs, with no name or email once your account is deleted"; your account after you delete it, "deleted at once; its files within 24 hours"; sessions, "14 days after last use"; server logs, "30 days; they hold ids only". |
| LG-FR-09 | **Your choices.** Disconnect YouTube or Instagram (Settings, when switched on; or revoke Sponing in Google or Instagram's own settings); delete your account (`/data-deletion`); ask what Sponing holds about you by email (LG-FR-04). |
| LG-FR-10 | **Cookies.** One HttpOnly session cookie for a signed-in creator and one per deal for a brand opened from a link; no tracking or advertising cookies (SI-BR-01, the brand-access ADR). |

### The terms (`/terms`)

| ID | Requirement |
| --- | --- |
| LG-FR-11 | **What Sponing is and isn't.** Sponing runs a sponsorship deal a creator and a brand have already agreed; it is not a marketplace and not a party to their agreement. It is a hackathon project on PayPal's sandbox: no real money moves. Then, each from PRODUCT.md's rules in plain words: one post on one platform per deliverable, each with its own hold; both sides agree the checklist before any hold; the review window is 48 hours from a fully passing draft and only a fully passing draft clears on silence; no publishing without a re-confirmed hold, and a go-ahead lasts 48 hours; capture only after a passing live check; a missed deadline or a cancel releases the hold to the brand; either side can cancel until there is a go-ahead; a hold is released on day 28 if nothing else has ended it; Sponing's 5% fee comes out of the creator's payout, in whole cents rounded down; a hold is $20 to $10,000. |
| LG-FR-12 | **The AI and its limits.** AI reads the brief and checks the draft and gives findings with evidence; code checks the evidence; anything unsure goes to a person; the AI never moves money. The AI can be wrong, which is why every finding shows its evidence and either side can object or ask. Each side keeps to YouTube's and Instagram's rules, including the paid-partnership label (always checked by a person on Instagram). Sponing can't promise that YouTube, Instagram or PayPal are available, or that PayPal accepts every hold, capture or payout; when one fails, the page says why and what happens next. Then the account, deleting it (`/data-deletion`), and contact. |

### The data-deletion page (`/data-deletion`)

| ID | Requirement |
| --- | --- |
| LG-FR-13 | **How to delete.** By email to the contact address (LG-FR-04) from, or naming, the Google email the creator signed in with, and how long it takes (Furqaan's answer). When `NEXT_PUBLIC_ACCOUNT_REMOVAL` is on, it first offers Settings → Delete account (ST-FR-10) and that deleting is refused while a deal is open (ST-FR-11); with it off, Settings isn't mentioned. Then what is deleted and what is kept, in ST-FR-10's words: profile, connected accounts and drafts deleted; payment records (amounts, dates and PayPal references) kept with name and email removed. Removing Sponing in Instagram's or Google's own settings stops Sponing reading that account. A brand, which has no account, can ask by email to have its email removed. (1.1) A request by email is done "within 30 days" (AH-FR-22). Delete account is always in Settings (ST 1.3), so the page always offers it first. |

### Links and release

| ID | Requirement |
| --- | --- |
| LG-FR-14 | **Not linked until complete.** The three routes are built, but no page links to them until every period in LG-FR-08 and LG-FR-13 is Furqaan's answer. The links (LP 1.7, SI 1.3, ST 1.2, CH 1.5) are behind one build flag, `NEXT_PUBLIC_LEGAL_PAGES`, off until then; turning it on is the only change. With it off, nothing says they're coming. The pages carry `noindex` while the flag is off. (1.1) **Retired.** Every period is answered (AH-FR-24), so there is no flag: the pages are linked wherever LG-FR-15 says, and indexed. |
| LG-FR-15 | **Where the links go** (flag on): the landing footer ("Privacy", "Terms", "Data deletion"; LP 1.7); the sign-in page under the button, "By signing in you agree to the terms and privacy policy." with both linked (SI 1.3); Settings, "Privacy policy" and "Terms" beside Sign out, and "How deleting works" linking to `/data-deletion` in Delete account (ST 1.2); a quiet footer with the three links on the brand's deal page and review pages (CH 1.5). |
| LG-FR-16 | Mobile-first at 375 px: one column, no sideways scroll, every link at least 44 px tall in lists; headings in order (one `h1`, then `h2`s); the sections list is a `nav` named "On this page"; reduced motion respected (no smooth-scroll animation). |

## Business rules

| ID | Rule |
| --- | --- |
| LG-BR-01 | Every statement traces to a signed spec, PRODUCT.md or an ADR. A change to what Sponing does that one of these pages describes updates the page in the same change. |
| LG-BR-02 | Nothing promised that the backend doesn't do; periods and deletion times are Furqaan's. |
| LG-BR-03 | No "coming soon": the pages are linked when complete, not before (LG-FR-14). |
| LG-BR-04 | The pages never show a token, reference or any personal data; they are the same for everyone. |

## Implementation Decisions

- **Routes:** `/privacy`, `/terms`, `/data-deletion`, static, outside the creator app's signed-in layout.
- **Modules:** one **reading layout** component (header, title, last updated, the project line, the sections list, the sections, contact, footer) taking a page's sections as data; each page's text as structured content (section id, heading, paragraphs and lists), tested for its required statements.
- **Flag:** `NEXT_PUBLIC_LEGAL_PAGES`, read at build time like the others; off by default.
- **Visual:** inherits DESIGN.md; no mockup round (William's choice). Screenshots at 375 px and desktop before commit.

### Requests for Furqaan

| For | Needs |
| --- | --- |
| LG-FR-08 | How long Sponing keeps: drafts after a deal ends; transcripts, frames and check results; payment records; account data after deleting; server logs (1.1) Answered: AH-FR-24. |
| LG-FR-13 | How fast a deletion request by email is done, and who does it until `DELETE /me` exists (1.1) Answered: within 30 days, by Furqaan with a command on the server (AH-FR-22). |
| LG-FR-07 | Confirm the processor list (anything else in the backend, such as error monitoring) (1.1) Answered: the list is right; no error monitoring. |
| Later | Meta's data-deletion callback (when someone removes Sponing in Instagram), after the hackathon |

### For William or Furqaan (not the agent)

- Enter `/privacy` in Google's OAuth consent screen, and `/privacy` and `/data-deletion` in Meta's app settings, once the flag is on and the app is deployed.

## Testing Decisions

- Tests check what a reader sees, named after the LG-FR they prove.
- **Pages:** each page's title, last-updated line, project line, sections list linking to every section, contact link; the privacy policy names every processor and every thing collected; the terms carry each money rule and the AI rule; the data-deletion page with the removal flag on and off.
- **Links:** with the legal flag off, no page links to the three routes; with it on, each placement in LG-FR-15 links to the right route.
- **Layout:** at 375 px and desktop, no sideways scroll (Playwright).

## Out of Scope

- A cookie banner (one functional session cookie, no tracking).
- Separate brand terms shown before the hold.
- Legal review, and terms for a live (non-sandbox) service.
- Meta's deletion callback (later, Furqaan).

## Open items

- **Retention periods and deletion time** (Furqaan; LG-FR-08, LG-FR-13). (1.1) Answered by AH 1.0.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: the agent drafts from what Cleared does, checked by both leads; `/privacy`, `/terms`, `/data-deletion` linked from the landing footer, sign-in, Settings and the brand's pages; deletion by email to William's address until Delete account is on, no Meta callback yet; periods are Furqaan's and the links stay off until he answers; plain terms from PRODUCT.md's rules; one reading layout, no mockups | none |
| 1.0 | Signed by William | none |
| 1.1 | From the legal grill-me with William, now that Furqaan has answered (AH 1.0): the periods (LG-FR-08), including the fetched Reel, access to accounts and sessions; within 30 days by email and Delete account always offered (LG-FR-13); the processor list confirmed (LG-FR-07); the flag retired, so the pages are linked and indexed (LG-FR-14) | [How long Cleared keeps things](../decisions/2026-10-12-how-long-cleared-keeps-things.md) |
| 1.1 signed | Revision 1.1 signed by William | none |
| 1.2 | The product is named Sponing: wording only, no behaviour changes. "Cleared" stays as the paid status | [The product is named Sponing](../decisions/2026-10-14-the-product-is-named-sponing.md) |
| 1.2 signed | Revision 1.2 signed by William | none |
