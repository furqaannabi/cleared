# Error pages: FRD

**Status:** Signed by William (revision 1.0).

**Surface:** The app-wide pages for an address that matches no page (not found), a page that crashes (something went wrong), and the whole app failing (the last-resort fallback). For anyone: a signed-in creator, a brand, or a stranger.

**Scope of this build:** frontend only. No new API calls except the landing header's existing `GET /me` (LP-FR-18). The existing in-page messages stay as they are: a creator's own deal or post that isn't found ("We couldn't find this deal", the draft check's load problem) and the brand's dead or session-less link (CH-FR-02, CH-FR-03, RW). This FRD adds only what Next shows when nothing else does.

## Problem Statement

A mistyped or old address shows Next's bare default 404, and a page that crashes shows Next's raw error screen. Neither looks like Cleared or says what to do next, which breaks the rule that nothing on Cleared is silent.

## Solution

Three small pages in Cleared's world. Not found says the page can't be found and offers the right next step for who is reading. Something went wrong says so, offers Try again and an email, and gives a reference to quote. The fallback does the same in a bare page when even the layout fails.

## User Stories

1. As a creator who mistypes an address, I want to be taken back to my deals, so that I'm not stuck.
2. As a stranger following an old link, I want to reach the home page, so that I can find out what Cleared is.
3. As a brand following a creator's link that went wrong, I want to know to open the link again or ask for a new one, so that I can get back to the deal.
4. As a creator whose page crashed, I want to try again without losing my place in the app, so that I can carry on.
5. As a creator whose page keeps crashing, I want an email address and a reference to quote, so that the team can find what happened.
6. As anyone, I want these pages to look like Cleared, so that I trust I'm still in the right place.
7. As a reader on a phone, I want every action reachable with my thumb, so that I can recover anywhere.

## Requirements

### Not found

| ID | Requirement |
| --- | --- |
| EP-FR-01 | **Any unknown address.** The landing page's header (with "Your deals" or "Sign in", LP-FR-18) and footer, then the heading "We can't find that page" and one line: "The address may be mistyped, or the page may have moved." Served with a 404 status. |
| EP-FR-02 | **The next step.** One primary button: "Open your deals" (to `/deals`) for a signed-in creator, otherwise "Go to the home page" (to `/`), from the same one `GET /me` as the header; while it is asking, and if it fails, the button is "Go to the home page". Under it, a quiet line for brands: "Opening a deal from a creator's link? Open the link again, or ask them for a new one." |

### Something went wrong

| ID | Requirement |
| --- | --- |
| EP-FR-03 | **A page crashes.** In place of the page: the heading "Something went wrong on this page", the line "Try again. If it keeps happening, email williamikeji@gmail.com." (the address a mailto link), and a "Try again" button that re-renders only the broken part. Inside the creator app the rail (or top bar) stays, so the deals are still reachable; on the brand's pages the slim brand frame stays. |
| EP-FR-04 | **The reference.** When Next gives the error a digest (a server error), a small "Reference: {digest}" line in ink-3, selectable; it names the error in the server logs and shows nothing private. With no digest, the line is left out. The error's message and stack are never shown. |
| EP-FR-05 | **The whole app fails.** When even the root layout fails, a bare page with its own `html` and `body`: the same heading, line and reference, and "Reload" (reloads the page), in the world's colours and fonts with no other app code. |

### Responsive and accessibility

| ID | Requirement |
| --- | --- |
| EP-FR-06 | Mobile-first at 375 px: one column, buttons at least 44 px, no sideways scroll. One `h1` per page; the error's heading is announced (`role="alert"` on its region); focus moves to the heading when the error page replaces a page. |

## Business rules

| ID | Rule |
| --- | --- |
| EP-BR-01 | No error page shows an error's message, stack, URL parameters, tokens or personal data. The digest is the only identifier shown. |
| EP-BR-02 | The existing in-page messages (a creator's deal not found, the brand's link messages) are not replaced; these pages only catch what nothing else does. |
| EP-BR-03 | Every error page says what to do next. |

## Implementation Decisions

- **Next's conventions:** `app/not-found.tsx` (EP-FR-01, EP-FR-02), `app/error.tsx` for the app-wide error boundary, a creator-app and a brand error boundary where the frames are, so the rail or brand frame stays (EP-FR-03), and `app/global-error.tsx` (EP-FR-05).
- **Modules:** one **error message** component (heading, line, Try again or Reload, reference) used by every boundary; the not-found page reuses the landing header and footer and the landing's signed-in context.
- **Visual:** inherits DESIGN.md; no mockup round. Screenshots at 375 px and desktop before commit.

## Testing Decisions

- Tests named after the EP-FR they prove.
- **Not found:** the heading, the line and the brands' line; "Open your deals" when signed in, "Go to the home page" signed out and when `/me` fails.
- **Error boundary:** the heading and line, the mailto link, Try again calls the reset, the reference shown with a digest and left out without one, the error's message never shown.
- **Global error:** its own document with Reload.
- **Live:** an unknown address returns 404 (Playwright).

## Out of Scope

- Sending errors to a monitoring service (needs Furqaan's choice and an ADR).
- Changing the brand's dead-link wording (CH-FR-02) or telling an expired link from an unknown one (the backend gives no reason, DS-FR-35).

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: app-wide pages only; one not-found page for everyone with the next step by who is reading; something went wrong with Try again, the contact email and the digest as a reference, keeping the rail or brand frame; a bare whole-app fallback; the existing in-page messages unchanged | none |
| 1.0 | Signed by William | none |
