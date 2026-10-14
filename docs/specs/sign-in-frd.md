# Sign-in and welcome: FRD

**Status:** Signed by William (revision 1.5). The sign-in itself is the backend's (Furqaan's [deal set-up](deal-setup-frd.md)).

**Surface:** How a creator gets into the creator app, and their first minute in it. The landing's "Sign in with Google", `/sign-in` for a signed-out visitor, `/welcome` the first time, and the account menu on the creator's name in the rail. The brand's side is unchanged: it gets in by its link ([brand access](../decisions/2026-10-08-brand-access-by-link-session.md)).

**Scope of this build:** frontend only, against the live API ([frontend on the live API](../decisions/2026-10-11-frontend-on-the-live-api.md)). The sign-in itself is the backend's: Google directly, with no Cognito ([creators sign in with Google directly](../decisions/2026-10-09-creators-sign-in-with-google-directly.md)). The page links to it and reads `GET /me`; it never holds a token. There is no demo account ([no demo accounts](../decisions/2026-10-11-no-demo-accounts.md)). What the backend needs is in [Requests for Furqaan](#requests-for-furqaan).

## Problem Statement

Today `/deals` opens straight into a made-up creator's deals: there is no account, so a real creator can't start their own deals, and a judge can't tell the product from a mockup. A creator needs to sign in, find their own deals, and understand on day one what Sponing does for them.

## Solution

The landing offers one way in. "Sign in with Google" signs a creator in through the backend, which sets an HttpOnly session; the first time, a welcome page states Sponing's promise in three lines and offers three skippable setup rows (YouTube, Instagram, PayPal email) before "Start your first deal". A signed-out visitor who opens a creator page is sent to a small sign-in page and returned where they were going. The creator's name in the rail opens a menu with their email and "Sign out".

## User Stories

1. As a creator, I want to sign in with my Google account, so that I don't need another password.
2. As a new creator, I want my account created the first time I sign in, so that there's no separate sign-up.
3. As a new creator, I want to be told plainly what Sponing does for me, so that I know why to use it.
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
15. *(1.1: removed; there is no demo account.)*
16. *(1.1: removed.)*
17. *(1.1: removed.)*
18. *(1.1: removed.)*
19. *(1.1: removed.)*
20. As a creator, I want my deals to be mine only, so that no other account sees them.
21. As a screen reader user, I want the sign-in button and the menu named and reachable by keyboard.
22. As a creator on a phone, I want the welcome page and sign-in at 375 px with large targets.
23. *(1.1: removed; the frontend runs on the live API.)*

## Requirements

### Ways in

| ID | Requirement |
| --- | --- |
| SI-FR-01 | **Sign in with Google.** A primary button "Sign in with Google" (the Google mark, 48 px) that is a plain link to the backend's `GET /auth/google?next=`; the page holds no Google code. Under it: "Instagram-only? Sign in with any Google account, then connect your Instagram." Nothing else sits beside it or under it. (1.1) (1.3) With `NEXT_PUBLIC_LEGAL_PAGES` on, under that: "By signing in you agree to the terms and privacy policy.", with "terms" linking to `/terms` and "privacy policy" to `/privacy` ([legal pages](legal-pages-frd.md) LG-FR-15). (1.4) The legal pages' flag is retired (LG 1.1), so these links always show. |
| SI-FR-02 | *Removed in 1.1: there is no demo account ([no demo accounts](../decisions/2026-10-11-no-demo-accounts.md)).* |
| SI-FR-03 | **Where it lands.** A first Google sign-in lands on `/welcome`; later ones on `/deals`, or on the page they were going to (SI-FR-06). (1.1) |
| SI-FR-04 | **Who is signed in.** Every creator page reads `GET /me`: the creator's name, email, and whether the welcome has been seen. While it loads, the app's loading state; if it fails for any reason other than "not signed in", Try again. (1.1: no demo flag.) |

### Signed out

| ID | Requirement |
| --- | --- |
| SI-FR-05 | **The sign-in page.** `/sign-in`: the Sponing mark, "Sign in to see your deals", and SI-FR-01's button and line. No other content. (1.1) |
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
| SI-FR-11 | **The creator's name** in the rail (DC-FR-31), and in the phone deals sheet, is a button that opens a small menu: the signed-in email and "Sign out". Under the name, "Creator". Escape and a tap outside close it; focus returns to the name. 1.2: "Settings" sits between the email and "Sign out", going to `/settings` ([settings](settings-frd.md)). |
| SI-FR-12 | **Sign out** calls the backend's sign-out, then opens the landing. |
| SI-FR-13 | *Removed in 1.1: no demo account, so no "Demo account" label and no "Leave the demo". The rail's "Reset demo data" goes with the mocks ([frontend on the live API](../decisions/2026-10-11-frontend-on-the-live-api.md)).* |

### Responsive and accessibility

| ID | Requirement |
| --- | --- |
| SI-FR-14 | *Removed in 1.1: the mock accounts. The pages run on the live API; tests stub their own requests (Testing Decisions).* |
| SI-FR-15 | Mobile-first at 375 px: the welcome page in one column, the setup rows full width, every target at least 44 px, no sideways scroll. |
| SI-FR-16 | The button and the menu named and reachable by keyboard; the menu button reports open or closed; the welcome page has one `h1`. |

## Business rules

| ID | Rule |
| --- | --- |
| SI-BR-01 | The frontend never stores, reads or logs a Google token; the session is an HttpOnly cookie the page can't read (CLAUDE.md "Auth"). |
| SI-BR-02 | `next` is only ever a same-site path (SI-FR-06); the backend checks it again. |
| SI-BR-03 | A creator sees only their own deals; every creator route checks the session's owner (CLAUDE.md "Auth"). |
| SI-BR-04 | *Removed in 1.1: no demo data.* |

## Implementation Decisions

- **Session (pure plus a provider):** one provider reads `GET /me` once and gives the app the creator, or "signed out"; creator pages wait on it. A pure helper decides where to send a signed-out visitor and whether a `next` path is safe.
- **Pages:** `/sign-in` and `/welcome` as small client routes; the landing's action block holds the one button.
- **Components:** the sign-in button and its line (shared by the landing and `/sign-in`), the promise, the setup rows (reusing the invite's connect cards and PayPal email field), the account menu. Each under ~200 lines.
- **API client:** `getMe()`, `markWelcomeSeen()`, `signOut()`; sign-in itself is a link, not a fetch. Response shapes come from the contract (`contract/api.d.ts`); Zod still checks each response. (1.1)
- **Removed in 1.1:** the mock session, the mock sign-in route and the mock accounts; the demo flag on the profile.

### The contract

From `contract/openapi.json` (1.1):

```ts
GET  /auth/google?next=/path      // Google's sign-in; the backend sets the HttpOnly session and returns to next, or /welcome the first time
POST /auth/sign-out               // clears the session
GET  /me → Profile | 401          // Profile: { name: string; email?: string; welcomed: boolean; paypalEmail?: string; accounts: { platform: "youtube" | "instagram"; name: string }[] }
POST /me/welcomed                 // marks the welcome seen
```

**Difference from 1.0's provisional shape:** `email` is optional in the contract; the menu (SI-FR-11) shows it, so it is listed for Furqaan below. `demo` is gone.

### Requests for Furqaan

| For | Needs |
| --- | --- |
| SI-FR-01, SI-FR-03, SI-FR-06 | The Google sign-in with the callback on the backend; an HttpOnly, Secure, SameSite=Lax session cookie; `next` accepted only as a same-site path; first sign-in creates the creator (built, DS) |
| SI-FR-02, SI-BR-04 | *Withdrawn in 1.1:* `POST /auth/demo` |
| SI-FR-04, SI-FR-11 | `email` always present on `GET /me`'s Profile for a signed-in creator, since the menu shows it (1.1) |
| SI-FR-10 | `POST /me/welcomed` (built) |
| SI-FR-12 | `POST /auth/sign-out` (built) |
| SI-BR-03 | Every creator route checks the session and the deal's owner |
| Testing (1.1) | A test-only way for Playwright to get a creator session on the live backend without Google's page, accepted only with a secret held in CI and never in the repo or the bundle; or another way Furqaan prefers ([frontend on the live API](../decisions/2026-10-11-frontend-on-the-live-api.md)) |
| Local work (1.1) | Sandbox Google and PayPal credentials for William's local backend, shared privately, never committed |
| Security | Every changing request protected from cross-site requests, as DC's; the Google app switched to "In production" before submission (PRODUCT.md) |

## Testing Decisions

- Tests check what a visitor sees and can do, named after the SI-FR they prove.
- **Pure:** where a signed-out visitor goes; `next` accepted for `/deals/x` and refused for `//evil.example`, `https://…` and `javascript:`.
- **Components (Vitest, per-test stubs typed from the contract) (1.1):** the landing's one button and its target; `/sign-in` keeping `next`; the welcome page's promise, rows and both exits, shown once; the account menu with the email and Sign out; a signed-out creator page (`/me` stubbed to 401) sent to sign-in; `/me` failing offers Try again.
- **End to end (Playwright, against the hosted app and the live backend) (1.1):** signed out: the landing's button goes to the backend's Google route with `next`; a bookmarked deal goes to `/sign-in?next=`; at 375 px and 1280 px. Signed in (once Furqaan's test session exists): the welcome page, Skip for now, the deals, Sign out to the landing.

## Out of Scope

- Settings: changing the PayPal email or connected accounts after the welcome, and deleting the account. 1.2: in the [settings FRD](settings-frd.md).
- Email and password sign-in, email codes, Instagram as a sign-in.
- Emails about signing in.
- The brand's access (unchanged).

## Open items

- **How a judge runs the demo** (both leads, before submission): without a demo account a judge needs a Google account that can sign in (only listed test users while the Google app is in Testing), their own YouTube channel behind Google's unverified-app warning, and can't connect Instagram ([no demo accounts](../decisions/2026-10-11-no-demo-accounts.md), PRODUCT.md "Still open"). (1.1)
- *Closed in 1.1:* the demo's brand side.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: Sign in with Google and Try the demo account; the backend runs the sign-in and sets an HttpOnly session; a welcome page with the promise and three skippable setup rows; a sign-in page that returns the creator where they were going; a fresh demo copy per visit; Sign out on the creator's name; Google only; two accounts on mocks | [Creator sign-in through the backend](../decisions/2026-10-08-creator-sign-in-through-the-backend.md) |
| 1.0 | Signed by William | none |
| 1.1 | From the grill-me with William after Furqaan removed demo accounts: Sign in with Google alone, with no note beside it (SI-FR-01, SI-FR-05); SI-FR-02, SI-FR-13, SI-FR-14 and SI-BR-04 and the judge stories removed; no demo flag on `/me`; Google directly, no Cognito; the pages on the live API, with per-test stubs and live end-to-end; the contract's shapes, with `email` asked for; requests for a test session and local credentials; how a judge runs the demo is open | [No demo accounts](../decisions/2026-10-11-no-demo-accounts.md), [Creators sign in with Google directly](../decisions/2026-10-09-creators-sign-in-with-google-directly.md), [Frontend on the live API](../decisions/2026-10-11-frontend-on-the-live-api.md) |
| 1.1 signed | Revision 1.1 signed by William | none |
| 1.2 | From the Settings grill-me with William: the name menu gains "Settings" between the email and "Sign out" (SI-FR-11); Out of Scope points to the settings FRD | none |
| 1.2 signed | Revision 1.2 signed by William | none |
| 1.3 | From the legal pages grill-me: the terms line under Sign in with Google, behind the legal flag ([legal pages](legal-pages-frd.md)) | none |
| 1.3 signed | Revision 1.3 signed by William | none |
| 1.4 | The legal pages' flag is retired (LG 1.1): the terms line under Sign in with Google always shows | none |
| 1.4 signed | Revision 1.4 signed by William | none |
| 1.5 | The product is named Sponing: wording only, no behaviour changes. "Cleared" stays as the paid status | [The product is named Sponing](../decisions/2026-10-14-the-product-is-named-sponing.md) |
| 1.5 signed | Revision 1.5 signed by William | none |
