# Sign-in and welcome: FRD

**Status:** Signed by William (revision 1.0). The sign-in itself is the backend's (Furqaan to review).

**Surface:** How a creator gets into the creator app, and their first minute in it. The landing's two ways in ("Sign in with Google", "Try the demo account"), `/sign-in` for a signed-out visitor, `/welcome` the first time, and the account menu on the creator's name in the rail. The brand's side is unchanged: it gets in by its link ([brand access](../decisions/2026-10-08-brand-access-by-link-session.md)).

**Scope of this build:** frontend only, against provisional mocks. The sign-in itself is the backend's ([creator sign-in through the backend](../decisions/2026-10-08-creator-sign-in-through-the-backend.md)): the page links to it and reads `GET /me`; it never holds a token. What the backend needs is in [Requests for Furqaan](#requests-for-furqaan).

## Problem Statement

Today `/deals` opens straight into a made-up creator's deals: there is no account, so a real creator can't start their own deals, and a judge can't tell the product from a mockup. A creator needs to sign in, find their own deals, and understand on day one what Cleared does for them. Judges need a way in that works without connecting a YouTube or Instagram account, which they can't do while the apps are unreviewed (PRODUCT.md "Risks to test first").

## Solution

The landing offers two ways in. "Sign in with Google" signs a creator in through the backend, which sets an HttpOnly session; the first time, a welcome page states Cleared's promise in three lines and offers three skippable setup rows (YouTube, Instagram, PayPal email) before "Start your first deal". "Try the demo account" opens the visitor's own fresh copy of a pre-connected demo creator with seeded deals, labelled "Demo account". A signed-out visitor who opens a creator page is sent to a small sign-in page and returned where they were going. The creator's name in the rail opens a menu with "Sign out" (or "Leave the demo").

## User Stories

1. As a creator, I want to sign in with my Google account, so that I don't need another password.
2. As a new creator, I want my account created the first time I sign in, so that there's no separate sign-up.
3. As a new creator, I want to be told plainly what Cleared does for me, so that I know why to use it.
4. As a new creator, I want to know my brand's money is held before I start, so that I don't make content for free.
5. As a new creator, I want to know my draft is checked against the brief before I publish, so that I'm not surprised at review.
6. As a new creator, I want to know I'm paid when my post goes live, so that I don't chase invoices.
7. As a new creator, I want to connect YouTube or Instagram and give my PayPal email on day one if I like, so that my first deal is quicker.
8. As a new creator, I want to skip setup, so that I can look around first.
9. As a creator, I want the welcome page only once, so that it doesn't get in the way afterwards.
10. As a returning creator, I want sign-in to take me straight to my deals, so that I can carry on.
11. As a creator who opened a bookmarked deal while signed out, I want to sign in and land on that deal, so that I don't hunt for it.
12. As a creator whose session ended, I want to sign in again and continue where I was.
13. As an Instagram-only creator, I want to know I can sign in with any Google account and connect Instagram after, so that I'm not stuck.
14. As a creator, I want to sign out from my name in the rail, so that my deals are safe on a shared device.
15. As a judge, I want to try the product without connecting any account, so that I can see a whole deal.
16. As a judge, I want my own copy of the demo, so that another judge's actions don't change what I see.
17. As a judge, I want the demo clearly labelled, so that I don't mistake it for real money.
18. As a judge, I want to reset my demo, so that I can run it again.
19. As a judge, I want to leave the demo and return to the landing, so that I can try signing in for real.
20. As a creator, I want my deals to be mine only, so that no other account sees them.
21. As a screen reader user, I want the sign-in buttons and the menu named and reachable by keyboard.
22. As a creator on a phone, I want the welcome page and sign-in at 375 px with large targets.
23. As William demoing on mocks, I want both ways in to work, a new account with no deals and the demo account with every seeded deal, so that I can show a first sign-in and a full deal.

## Requirements

### Ways in

| ID | Requirement |
| --- | --- |
| SI-FR-01 | **Sign in with Google.** A primary button "Sign in with Google" (the Google mark, 48 px) that is a plain link to the backend's sign-in route; the page holds no Google or Cognito code. Under it: "Instagram-only? Sign in with any Google account, then connect your Instagram." |
| SI-FR-02 | **Try the demo account.** An outlined button "Try the demo account" that starts the backend's demo route: the visitor's own fresh copy of the demo creator, Ada Okafor, with the seeded deals. Under it: "Made-up data. No real money moves." |
| SI-FR-03 | **Where each lands.** A first Google sign-in lands on `/welcome`; later ones on `/deals`, or on the page they were going to (SI-FR-06). The demo lands on `/deals`. |
| SI-FR-04 | **Who is signed in.** Every creator page reads `GET /me`: the creator's name, email, whether this is the demo account, and whether the welcome has been seen. While it loads, the app's loading state; if it fails for any reason other than "not signed in", Try again. |

### Signed out

| ID | Requirement |
| --- | --- |
| SI-FR-05 | **The sign-in page.** `/sign-in`: the Cleared mark, "Sign in to see your deals", and SI-FR-01's and SI-FR-02's buttons. No other content. |
| SI-FR-06 | **Back where they were going.** A creator page that gets "not signed in" from `GET /me` goes to `/sign-in?next={path}`. The sign-in passes `next` to the backend, which returns the creator there after signing in. The page sends `next` only when it is a path on this site (starts with a single `/`, no scheme, no `//`); otherwise it drops it. |
| SI-FR-07 | **A session that ends** mid-use (any creator request answering "not signed in") goes to `/sign-in?next=` with the current path. Nothing typed is kept. |

### The welcome page

| ID | Requirement |
| --- | --- |
| SI-FR-08 | **The promise.** `/welcome`, once per account: "Welcome, {first name}", the headline "Get paid for every brand deal, on time.", then three lines, each with its seal: "The money is held before you start." / "Your brand's payment is held in PayPal before you make anything."; "No surprises at review." / "We check your draft against the brief before you publish, and the brand has 48 hours to object."; "Paid when your post goes live." / "Once the live check passes, the money comes to your PayPal. No chasing invoices." |
| SI-FR-09 | **Set up in a minute.** Three rows, each optional and saved as it's done: Connect YouTube (read-only), Connect Instagram ("Professional accounts only"), and "Your PayPal email" with IN-FR-12's check and warning. Connecting follows IN-FR-10 and IN-FR-11; the email saves to the profile. A connected or saved row shows its done state. |
| SI-FR-10 | **On from there.** "Start your first deal" (primary) opens `/deals/new`; "Skip for now" opens `/deals`. Either marks the welcome seen; it never shows again for this account. The invite step still asks for anything left out. |

### The account menu

| ID | Requirement |
| --- | --- |
| SI-FR-11 | **The creator's name** in the rail (DC-FR-31), and in the phone deals sheet, is a button that opens a small menu: the signed-in email and "Sign out". Escape and a tap outside close it; focus returns to the name. Settings joins it when its spec adds it. |
| SI-FR-12 | **Sign out** calls the backend's sign-out, then opens the landing. |
| SI-FR-13 | **The demo account** shows "Demo account" under the name; its menu item reads "Leave the demo" and does the same as Sign out. "Reset demo data" stays in the rail. |

### Mocks, responsive and accessibility

| ID | Requirement |
| --- | --- |
| SI-FR-14 | **Mocks.** Two accounts. "Sign in with Google" signs in a new made-up creator, Sam Rivera, with no deals, who sees the welcome page; "Try the demo account" signs in Ada Okafor with every seeded deal. Each deal belongs to the account that made it. Mock builds start signed out; Vitest starts signed in as the demo account, except the sign-in tests. "Reset demo data" signs out and restores the seed. |
| SI-FR-15 | Mobile-first at 375 px: the welcome page in one column, the setup rows full width, every target at least 44 px, no sideways scroll. |
| SI-FR-16 | Buttons and the menu named and reachable by keyboard; the menu button reports open or closed; the welcome page has one `h1`. |

## Business rules

| ID | Rule |
| --- | --- |
| SI-BR-01 | The frontend never stores, reads or logs a Cognito or Google token; the session is an HttpOnly cookie the page can't read (CLAUDE.md "Auth"). |
| SI-BR-02 | `next` is only ever a same-site path (SI-FR-06); the backend checks it again. |
| SI-BR-03 | A creator sees only their own deals; every creator route checks the session's owner (CLAUDE.md "Auth"). |
| SI-BR-04 | Demo data is synthetic, on the PayPal sandbox, and labelled on screen while signed in to the demo. |

## Implementation Decisions

- **Session (pure plus a provider):** one provider reads `GET /me` once and gives the app the creator, or "signed out"; creator pages wait on it. A pure helper decides where to send a signed-out visitor and whether a `next` path is safe.
- **Pages:** `/sign-in` and `/welcome` as small client routes; the landing's action block gains the two ways in.
- **Components:** the two sign-in buttons (shared by the landing and `/sign-in`), the promise, the setup rows (reusing the invite's connect cards and PayPal email field), the account menu. Each under ~200 lines.
- **API client:** `getMe()`, `markWelcomeSeen()`, `signOut()`; sign-in itself is a link, not a fetch.
- **Mocks:** a signed-in account (none, the new creator, or the demo); `/me` answers 401 when signed out; deals carry an owner; the existing creator routes answer only the owner's deals.

### The contract (provisional)

```ts
GET  /auth/google?next=/path      // redirect to Cognito's Google sign-in; back via the callback
GET  /auth/callback               // the backend's; sets the HttpOnly session cookie, redirects to next or /welcome
POST /auth/demo?next=/path        // the visitor's own demo copy; sets the session; redirects
POST /auth/sign-out               // clears the session and ends the Cognito session
GET  /me → { name: string; email: string; demo: boolean; welcomed: boolean; paypalEmail?: string; accounts: … } | 401
POST /me/welcomed                 // marks the welcome seen
```

### Requests for Furqaan

| For | Needs |
| --- | --- |
| SI-FR-01, SI-FR-03, SI-FR-06 | The Google sign-in through Cognito with the callback on the backend; an HttpOnly, Secure, SameSite=Lax session cookie; `next` accepted only as a same-site path; first sign-in creates the creator |
| SI-FR-02, SI-BR-04 | `POST /auth/demo`: a fresh demo creator per visit, seeded with the demo deals and pre-connected accounts, on the sandbox; deleted after 7 days |
| SI-FR-04, SI-FR-10 | `GET /me` as above, 401 when signed out; `POST /me/welcomed` |
| SI-FR-12 | `POST /auth/sign-out`, ending the Cognito session too |
| SI-BR-03 | Every creator route checks the session and the deal's owner |
| Security | Every changing request protected from cross-site requests, as DC's; the Google app switched to "In production" before submission (PRODUCT.md) |

## Testing Decisions

- Tests check what a visitor sees and can do, named after the SI-FR they prove.
- **Pure:** where a signed-out visitor goes; `next` accepted for `/deals/x` and refused for `//evil.example`, `https://…` and `javascript:`.
- **Mock API:** `/me` 401 when signed out; the new account has no deals and isn't welcomed; the demo has the seed; deals belong to their account; sign-out signs out.
- **Components:** the landing's two ways in; `/sign-in` keeping `next`; the welcome page's promise, rows and both exits, shown once; the account menu with Sign out and the demo's Leave the demo; a signed-out creator page sent to sign-in.
- **End to end (Playwright, on MSW):** sign in with Google → welcome → connect YouTube → Start your first deal; Try the demo account → deals → Leave the demo → landing; a signed-out bookmarked deal → sign in → that deal; at 375 px and 1280 px.

## Out of Scope

- Settings (its own spec next): changing the PayPal email or connected accounts after the welcome, and deleting the account.
- Email and password sign-in, email codes, Instagram as a sign-in.
- Emails about signing in.
- The brand's access (unchanged).

## Open items

- **The demo's brand side:** each demo copy's brand links open that copy's brand view, as on mocks; Furqaan to confirm the demo route can mint them.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: Sign in with Google and Try the demo account; the backend runs the sign-in and sets an HttpOnly session; a welcome page with the promise and three skippable setup rows; a sign-in page that returns the creator where they were going; a fresh demo copy per visit; Sign out on the creator's name; Google only; two accounts on mocks | [Creator sign-in through the backend](../decisions/2026-10-08-creator-sign-in-through-the-backend.md) |
| 1.0 | Signed by William | none |
