# Settings: FRD

**Status:** Signed by William (revision 1.3). Disconnecting and deleting the account are product behaviour shared with Furqaan, who builds their routes; they are written here as requests.

**Surface:** The creator's account settings at `/settings`: the signed-in email, the PayPal email, the connected YouTube and Instagram accounts, signing out, and (behind a flag until the backend has them) disconnecting an account and deleting the account. Reached from the account menu on the creator's name ([sign-in](sign-in-frd.md) SI-FR-11). The brand has no account and no settings.

**Scope of this build:** frontend only, on the live API ([frontend on the live API](../decisions/2026-10-11-frontend-on-the-live-api.md)). Reading the profile, changing the PayPal email, connecting and signing out use routes the contract has. Disconnecting and deleting are built and tested on per-test stubs against the routes asked of Furqaan below, and stay hidden behind a build flag until those routes are in `contract/` (ST-FR-12). Nothing here moves money.

## Problem Statement

After the welcome, a creator has nowhere to change their PayPal email, see which YouTube channel or Instagram account Cleared reads, reconnect one whose access lapsed, or leave Cleared. The PayPal email can only be changed from inside a deal's invite, and a lapsed connection is only found out when a go-ahead or a live check is refused.

## Solution

One settings page, reached from the name menu, that says who is signed in, where the money goes, and which accounts Cleared reads, and lets the creator change each. Disconnecting or deleting is refused, with the reason, while it would put a deal at risk; otherwise each is confirmed in place.

## User Stories

1. As a creator, I want to see which Google account I'm signed in with, so that I know whose deals I'm looking at.
2. As a creator, I want to change my PayPal email in one place, so that I don't have to open a deal to do it.
3. As a creator, I want to be told which payouts keep my old PayPal email, so that I know where money already on its way will land.
4. As a creator, I want to see the name of the YouTube channel and Instagram account Cleared reads, so that I know it's the right one.
5. As a creator, I want to connect an account I haven't connected, so that I can take deals on that platform.
6. As a creator, I want to reconnect an account whose access lapsed, so that my go-ahead and live check can run.
7. As a creator, I want to disconnect an account I no longer want Cleared to read, so that it stops having access.
8. As a creator with a post under way on a platform, I want to be stopped from disconnecting it and told which post, so that I don't lose a payment by accident.
9. As a creator, I want to delete my account, so that Cleared no longer holds my details.
10. As a creator with an open deal, I want to be told what has to finish first, so that deleting never leaves a brand or a payment half-done.
11. As a creator, I want deleting to need a deliberate step, so that I can't do it by accident.
12. As a creator, I want to sign out from the settings page too, so that I find it where I expect it.
13. As a creator on a phone, I want every setting reachable with my thumb, so that I can change things on the go.

## Requirements

### The page

| ID | Requirement |
| --- | --- |
| ST-FR-01 | **Where it lives.** `/settings`, in the creator frame (the rail from `lg:`, the usual header on phones), signed-in only like every creator page (SI-FR-06). Title "Settings". It is reached from "Settings" in the account menu (SI-FR-11, 1.2). |
| ST-FR-02 | **Signed in as.** "Signed in with Google as {email}", read-only. When the API sends no email, the line is left out. |
| ST-FR-03 | **Order.** Signed in as; Getting paid (the PayPal email); Connected accounts; then Sign out; then, when the flag is on, Delete account at the end, apart from the rest. |

### Getting paid

| ID | Requirement |
| --- | --- |
| ST-FR-04 | **PayPal email.** "Your PayPal email" with the saved email, or empty with "Add the email we pay you at." when there is none. "Change" opens it in place with IN-FR-12's field, check and line ("We send your payment here. Check it: a payment to the wrong email can't be pulled back."), and "Save" and "Keep it". Saved through `PUT /me/paypal-email`. |
| ST-FR-05 | **Payouts that keep the old email.** When the answer lists payouts already with PayPal, IN-FR-12's note shows under the field after saving, naming each by brand. Otherwise "Saved." is announced. |

### Connected accounts

| ID | Requirement |
| --- | --- |
| ST-FR-06 | **Each platform.** A row each for YouTube and Instagram. Connected: the account's name from the profile and "Reconnect". Not connected: "Not connected" and "Connect YouTube" or "Connect Instagram". Both actions are the existing connect links (IN 1.3), coming back to `/settings`, and the result shows as it does there. Instagram keeps its note that only professional accounts can connect. |
| ST-FR-07 | **Disconnect (behind the flag).** A connected row also offers "Disconnect". It opens an inline confirmation: "Disconnect {name}? Cleared stops reading it. You can connect it again later." with "Disconnect" and "Keep it". Sent as `DELETE /connect/{platform}`; the row then shows Not connected. (1.3) Always offered on a connected account the profile does not say is in use; no flag. |
| ST-FR-08 | **Refused while a post is under way.** When a post on that platform is held and not yet paid or released, disconnecting is refused and the row says: "You can't disconnect {platform} while a post is under way: {brand} · {post}." (each post named; "and {n} more" past three). The API decides; the page shows its answer, and offers no Disconnect while the profile says one is under way. (1.3) When the profile says the account is in use (`accounts[].inUse`, AH-FR-12), the row has no Disconnect and says under the account's name: "In use by a post under way. You can disconnect it once that post is paid or its hold goes back." Reconnect stays. A refusal from the API (a post started since the page loaded) still shows the line above, naming each post. |

### Signing out and deleting

| ID | Requirement |
| --- | --- |
| ST-FR-09 | **Sign out.** "Sign out" at the end of the page, doing what the menu's does (SI-FR-12). (1.2) With `NEXT_PUBLIC_LEGAL_PAGES` on, "Privacy policy" and "Terms" sit beside it, linking to `/privacy` and `/terms` ([legal pages](legal-pages-frd.md) LG-FR-15). |
| ST-FR-10 | **Delete account (behind the flag).** "Delete account" at the very end, apart from the rest. When nothing is open it opens an inline confirmation saying what happens: "Your profile, your connected accounts and your drafts are deleted. Cleared keeps the payment records it must (amounts, dates and PayPal references), with your name and email removed. This can't be undone." A field "Type delete to confirm" and "Delete my account", on only once "delete" is typed. Sent as `DELETE /me`; on success the creator is signed out and lands on the home page. (1.2) With `NEXT_PUBLIC_LEGAL_PAGES` on, the section also links "How deleting works" to `/data-deletion` ([legal pages](legal-pages-frd.md) LG-FR-15). (1.3) Always offered; no flag. The confirmation says, as AH-FR-17 to AH-FR-21 do: "Your profile, your connected accounts, your drafts, and each deal's brief, checklist and check results are deleted, and brands' links to your deals stop working. Cleared keeps the payment records it must (amounts, dates and PayPal references), with your name and emails removed. Signing in again starts a new, empty account. This can't be undone." Before it opens, the section says "Removes your profile, your connected accounts and everything in your deals." |
| ST-FR-11 | **Refused while anything is open.** While any deal has a post held and not yet paid or released, a payout not settled, or is waiting on its brand, deleting is refused and the section lists what's in the way, one line per deal ("Glow Theory: a post is held"), and says: "Finish or cancel these first." No confirmation opens. The API decides; the page shows its answer. |
| ST-FR-12 | **The flag.** Disconnecting and deleting show only when the build flag `NEXT_PUBLIC_ACCOUNT_REMOVAL` is "enabled". It stays off until Furqaan's routes and their types are in `contract/`; then turning it on is the only change. With it off, neither shows, and nothing says they're coming. (1.3) **Retired.** Both routes are in the contract and live (AH 1.0): Disconnect and Delete account always show, as ST-FR-07, ST-FR-08 and ST-FR-10 say. |

### Responsive and accessibility

| ID | Requirement |
| --- | --- |
| ST-FR-13 | Mobile-first at 375 px: one column, every target at least 44 px, fields full width, no sideways scroll. From `md:` the sections may sit in a narrower centred column. Confirmations open in place, never as modals. |
| ST-FR-14 | Every control named ("Change your PayPal email", "Reconnect YouTube", "Disconnect Instagram"); each section a labelled region; saving, connecting, refusals and disconnecting announced politely; focus returns to the action that opened a confirmation when it closes; reduced motion respected. |

## Business rules

| ID | Rule |
| --- | --- |
| ST-BR-01 | Nothing on this page moves money or decides a money state. Disconnecting and deleting are refused, not worked around, while a deal needs them (the money path's rules stand). |
| ST-BR-02 | The PayPal email is only ever shown to the creator (IN-BR-05). |
| ST-BR-03 | The page never sees or stores a token: connecting is a link to the backend, the session an HttpOnly cookie (SI-BR-01). |
| ST-BR-04 | Whether disconnecting or deleting is allowed is the API's answer; the page shows it and never decides it alone. |
| ST-BR-05 | No "coming soon": disconnecting and deleting are either fully working or not shown (ST-FR-12). |

## Implementation Decisions

- **Route:** `/settings` under the creator app's signed-in layout.
- **Modules:** a pure **settings view** turning the profile into each section's state (email line, PayPal email, each platform's row and its actions, whether Disconnect and Delete show and why not); tested on its own. The **refusal wording** for disconnecting and deleting from the API's answer is pure too.
- **Reused:** the PayPal email field and its check (IN-FR-12), the keeping-email note, the connect links and their result, and Sign out.
- **Data:** the profile from `GET /me`, Zod-checked against the contract's `Profile`. The client gains `disconnect(platform)` and `deleteAccount()` for the requested routes, used only behind the flag.
- **The flag:** read at build time like the mocking flag; off by default.
- **Visual:** inherits DESIGN.md. Rendered mockups in `design/settings/` before build, at 390 px and desktop; William picks.

### Requests for Furqaan

| For | Needs |
| --- | --- |
| ST-FR-07, ST-FR-08 | `DELETE /connect/{platform}`: removes the stored access and the connected account. Refused with 409 `post_under_way` and the posts in the way as `error.blocking` (`{ dealId, deliverableId, brandName, platform }[]`) while a post on that platform is held and not yet paid or released. Answers the profile (1.3) Answered by AH 1.0 (AH-FR-10, AH-FR-11). |
| ST-FR-08 | The profile says, per connected account, whether it can be disconnected now, so the page can leave Disconnect out (for instance `accounts[].inUse: true`) (1.3) Answered: `accounts[].inUse` (AH-FR-12). |
| ST-FR-10, ST-FR-11 | `DELETE /me`: refused with 409 `deal_open` and what's in the way as `error.blocking` (`{ dealId, brandName, why: "held" \| "payout" \| "waiting_for_brand" }[]`) while anything is open. Otherwise deletes the profile, tokens and drafts, keeps the money records with the name and email removed, ends every session, and answers 204 (1.3) Answered by AH 1.0 (AH-FR-15, AH-FR-16). |
| ST-FR-10 | What is kept and for how long: Furqaan's call with William; the privacy policy will say it (1.3) Answered: AH-FR-17, AH-FR-18 and AH-FR-24. |
| All | The routes and their types in `contract/` |

## Testing Decisions

- Tests check what the creator sees and can do, named after the ST-FR they prove, on per-test stubs typed from the contract (and from the requested shapes for disconnect and delete).
- **Settings view (pure):** each section with and without a PayPal email; each platform connected and not; Disconnect shown, hidden while in use, and hidden with the flag off; Delete shown or hidden by the flag.
- **Components:** changing the PayPal email, with and without payouts that keep the old one; Connect and Reconnect go to the right connect link and come back to `/settings`; disconnect confirmed and refused with the posts named; delete refused with what's in the way, the typed confirmation, and signing out after; Sign out; at 375 px and desktop.
- **Live end to end:** by hand until Furqaan's test-session route exists.

## Out of Scope

- Changing the name or the Google account signed in with.
- Notification or email preferences.
- A brand's settings (the brand has no account).
- Payment history and CSV (the creator dashboard, its own spec).
- Meta's data-deletion request page (its own page on the roadmap).

## Open items

- **What's kept after deleting, and for how long** (Furqaan with William).

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: Settings at `/settings` from the name menu; the signed-in email, the PayPal email with the keeping-email note, YouTube and Instagram with Connect or Reconnect, Sign out; disconnecting refused while a post on that platform is under way; deleting refused while anything is open, with a typed confirmation; both built on stubs behind a flag until Furqaan's routes exist | [Frontend on the live API](../decisions/2026-10-11-frontend-on-the-live-api.md) |
| 1.0 | Signed by William | none |
| 1.1 | Found while building: the requests say where a refusal's details sit (`error.blocking` in the 409 body); the page shows William's pick, design A with design B's profile band (DESIGN.md "Settings"). No requirement changes | none |
| 1.1 signed | Revision 1.1 signed by William | none |
| 1.2 | From the legal pages grill-me: Privacy policy and Terms beside Sign out, and How deleting works in Delete account, behind the legal flag ([legal pages](legal-pages-frd.md)) | none |
| 1.2 signed | Revision 1.2 signed by William | none |
| 1.3 | From the Settings grill-me with William, now that Furqaan's routes are live (AH 1.0): the flag is retired (ST-FR-12); an account in use says so in place of Disconnect (ST-FR-08); the delete confirmation says all that AH-FR-17 to AH-FR-21 delete and keep (ST-FR-10); the requests answered | none |
| 1.3 signed | Revision 1.3 signed by William | none |
