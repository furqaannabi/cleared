# Landing page: FRD

**Status:** Signed by William (revision 1.2).

**Surface:** Landing, at `/`. Anyone can open it. A static Server Component (CLAUDE.md "Surfaces"). It is the first thing a judge sees at the hosted demo URL, and the front door of the product's story.

**Scope of this build:** frontend only. The page makes no API calls. Its one action opens the creator app, which runs on the provisional mocks until the backend exists.

## Problem Statement

A mid-size creator doing a direct deal with a small brand has no safe way to run it. They post, then chase payment for weeks while it sits in "processing". The brand may say the video missed something after it is live and can no longer be changed. A visitor arriving at `/` today sees only a wordmark and a tagline: nothing says what Cleared does, why it is safe, or how to see it working.

## Solution

One page, written for creators, that says in plain words what Cleared does, shows the product itself (the held money beside the checked items), walks through how a deal runs, states the rules that protect the creator, and gets the visitor into a running deal with one button. Brands get one short section; they normally arrive through a creator's invite link, not this page. The hackathon, the tools used and the repository sit in the footer.

## User Stories

1. As a creator, I want to understand in one sentence what Cleared does, so that I know whether it is for me.
2. As a creator, I want to see the product itself on the first screen, so that I believe it exists and know what it looks like.
3. As a creator, I want one obvious way to see a deal running, so that I can try it without signing up.
4. As a creator, I want to be told the demo uses made-up data and moves no real money, so that I am not misled.
5. As a creator who has chased late payments, I want the page to name that problem, so that I recognise my situation.
6. As a creator, I want to see how a deal runs, step by step, so that I know what I and the brand each do.
7. As a creator, I want the rules that protect me stated plainly, so that I can trust an AI is checking my video.
8. As a creator, I want to know the AI never moves money, so that a model mistake cannot cost me.
9. As a creator, I want to know an unsure result goes to a person, so that I am never failed by a guess.
10. As a creator, I want to know a missed deadline returns the hold to the brand, so that I understand the deal is fair both ways.
11. As a brand, I want a short note on what I get, so that I know my money is only paid for a post that went live as agreed.
12. As a judge, I want the hackathon, the PayPal and AI technology and the sponsor tools named, so that I can check eligibility quickly.
13. As a judge, I want links to the repository and its licence, so that I can inspect the work.
14. As a creator on a phone, I want the page to read well at 375 px with the button on the first screen, so that I can act straight away.
15. As a visitor who prefers reduced motion, I want the page to stay still, so that it is comfortable.
16. As a visitor using a keyboard or screen reader, I want every link reachable and named, and the headings in order, so that I can use the page without a mouse.
17. As someone sharing the link, I want a clear title, description and preview image, so that the shared link reads well on Devpost and GitHub.

## Functional requirements

Wording below is the agreed content. Design may refine the words; it may not change or add a claim.

### Opening screen

| ID | Requirement |
| --- | --- |
| LP-FR-01 | **Header.** The Cleared logo, linking to `/`. From `md:` up, "See a deal in action" is repeated on the right. No navigation menu (there are no other pages). |
| LP-FR-02 | **Headline and one sentence.** The tagline "Brand deals where the content and the payment clear together." as the page's only `h1`, and one plain sentence on what Cleared does: the brand's money is held in PayPal, AI checks the video against the brief, and the creator is paid when the approved post is live. |
| LP-FR-03 | **Two ways in (1.2).** The sign-in FRD's "Sign in with Google" (primary, SI-FR-01) and "Try the demo account" (outlined, SI-FR-02), side by side from `sm:`, stacked on phones. Sign in with Google is the page's only primary action. No waitlist or "coming soon". |
| LP-FR-15 | **`/deals` opens the first deal.** A new creator-app route: it loads the creator's deals list (the one the rail uses, DC-FR-31) and opens the first deal, which opens its deliverable (DC-FR-37). With no deals it says plainly "You have no deals yet." inside the app shell. While the list loads it shows the app's loading state; if the list fails it offers Try again. No deal id is written into the landing page. (1.2) A signed-out visitor is sent to `/sign-in?next=/deals` first (SI-FR-06). |
| LP-FR-16 | **One photo.** The draft video's frame is a photo of a hand holding a serum dropper bottle: no face and no real brand, free licence (Unsplash). Served optimised (AVIF/WebP, sized per screen), with empty alt text since it is decorative beside the labelled example. |
| LP-FR-17 | **Closing.** Before the footer, an espresso band "See a whole deal clear." with the two ways in again and the demo note. |
| LP-FR-04 | **Demo note.** Under "Try the demo account": "Made-up data. No real money moves." (SI-FR-02). |
| LP-FR-05 | **Product visual.** A phone showing the creator app on the example deal: the draft video (a photo frame, LP-FR-16), its timeline with seal markers, and three checklist items; beside it, tilted slightly, the marigold "$1,200.00 held in PayPal" card. Built from the app's own components and tokens; its example data is written in the landing page, never imported from the mocks, and labelled as an example. |
| LP-FR-06 | **Motion.** All CSS, and still under reduced motion: on load the phone's timeline seals pop in and a pass seal stamps once onto the phone; the money card floats gently. As the visitor scrolls (where the browser supports scroll-driven animation; elsewhere everything simply shows): the chat messages appear one by one, the marigold thread joining the five steps draws down the page, each step's number seal stamps in while its words and panel slide in from opposite sides, the checklist items settle from "Checking" to their results, the review countdown ticks, and the CLEARED seal stamps onto the payout. |
| LP-FR-07 | **Phones.** Below `md:` the button is on the first screen; the visual follows it, cut down to the money card and two items. |

### The story

| ID | Requirement |
| --- | --- |
| LP-FR-08 | **The problem, as a chat.** A heading ("You post. Then you chase payment.") and one sentence beside a short chat between the creator and the brand, on espresso: Day 12 "Hi! Just checking in on the invoice for the video", "It's processing, should be soon!"; Day 34 "Hey, any update? It's been a month"; Day 41 "Legal says the code wasn't shown long enough. Can you re-edit?", "It's already live…". Illustrative, not a quote from a real person. |
| LP-FR-09 | **How a deal runs: one deal, start to paid.** The example Glow Theory deal in five steps joined by a marigold thread, each with a marigold number seal and a panel showing the app at that moment: (1) agree the checklist (three items with their brief lines); (2) money held in PayPal (the money card); (3) AI checks your draft (the video frame with a fail marker at 3:15, then three items with results); (4) 48-hour review (a countdown and "Silence clears a fully passing draft."); (5) publish, get paid (held, captured and paid, each with its PayPal reference, and a CLEARED seal). |
| LP-FR-10 | **Rules that protect you.** Four short promises, each from PRODUCT.md's locked rules, each with a pass seal: the AI never moves money; an unsure result goes to a person, never a guess; a missed deadline returns the hold to the brand; nothing clears on a timer unless every item passed. |
| LP-FR-11 | **For the brand.** One short block: the brand's money is held, not paid, until the approved post is live and checked; the brand reviews the draft before it is published. |

### Footer and page

| ID | Requirement |
| --- | --- |
| LP-FR-12 | **Footer.** Built for the PayPal AI Hackathon; PayPal sandbox only, no real money moves; what is used: PayPal (holds, capture and payouts), Claude on Amazon Bedrock (checking), AG Grid and APIMatic; links to the GitHub repository and its MIT licence. |
| LP-FR-13 | **Metadata.** Title "Cleared: brand deals where the content and the payment clear together"; a one-sentence description; a share image with the logo and the held-money card. |
| LP-FR-14 | **Static.** A Server Component with no client JavaScript of its own; no API calls; fonts already loaded by the app. |

## Business rules

| ID | Rule |
| --- | --- |
| LP-BR-01 | Every claim on the page is true of the product as specified in PRODUCT.md. No invented features, numbers, customers, testimonials, logos or prices. |
| LP-BR-02 | The page never asks for an account, email or payment details. |
| LP-BR-03 | The example data is synthetic and labelled; the names match the demo's (Glow Theory, the $1,200.00 hold). |
| LP-BR-04 | Words follow CLAUDE.md "Domain Language": deal, deliverable, checklist, hold, draft check, review window, live check, cleared. No PayPal or AWS jargon beyond naming the tools in the footer. |

## Implementation Decisions

- **Routes:** `web/src/app/page.tsx` stays a Server Component; `/deals` is a small client route in the creator app that reuses the deals list and the existing deal redirect; sections are small components in a `landing/` feature folder, each under ~200 lines with a JSDoc block naming its LP-FR.
- **Product visual:** reuses `MoneyCard`, `StatusSeal` and `StatusChip` with example props written in the landing folder. The production no-mock-data check keeps guarding that nothing from `src/mocks/` ships.
- **Motion:** CSS keyframes and scroll-driven animations (`animation-timeline: view()`) under `motion-safe:`, inside `@supports`, so unsupported browsers and reduced motion show the final state.
- **Design direction:** the visual world is DESIGN.md's. William chose option B2 (design/landing/option-b2.html) from the mockups; DESIGN.md records it after the build.

## Testing Decisions

- Tests check what a visitor sees and can do, named after the LP-FR they prove.
- **Components (Vitest, React Testing Library):** the `h1` and the one sentence; the button's target is `/deals`; `/deals` opens the first deal, says so when there are none, and offers Try again when the list fails; the demo note; the product visual shows "$1,200.00 held in PayPal" and three items, labelled as an example; the five steps; the four promises; the brand block; the footer links (repository, licence) and the named tools; heading order.
- **End to end (Playwright):** at 375 px and 1280 px, no sideways scroll, the button is on the first screen at 375 px, and pressing it opens the demo deal.
- **Checks:** AA contrast, 44 px targets, Lighthouse performance 95 or more on the production build.

## Out of Scope

- Waitlists and pricing. Sign-in is in the [sign-in FRD](sign-in-frd.md).
- A separate brand landing page or brand navigation.
- Blog, docs, legal pages.

## Open items

- None. (1.2: the demo entry is "Try the demo account", SI-FR-02.)

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: creator first; one action into the demo; five sections; the product as the visual; static | none |
| 1.0 | Signed by William | none |
| 1.1 | William chose design B2 from the mockups (design/landing/): the phone with the money card, the problem as a chat, one deal start to paid joined by a marigold thread, the CLEARED stamp, a closing band, one photo, and scroll-driven motion | none |
| 1.1 signed | Revision 1.1 signed by William | none |
| 1.2 | From the sign-in grill-me: LP-FR-03's one button becomes the two ways in (Sign in with Google, Try the demo account), LP-FR-04 and LP-FR-17 follow, LP-FR-15 sends a signed-out visitor to sign in first; the demo-entry open item closes. Tests follow | [Creator sign-in through the backend](../decisions/2026-10-08-creator-sign-in-through-the-backend.md) |
| 1.2 signed | Revision 1.2 signed by William | none |
