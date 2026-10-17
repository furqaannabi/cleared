# Vercel Web Analytics counts page visits, without invite tokens

**Date:** 2026-10-17
**Status:** Accepted (William signed LG 1.4, which carries option 1)
**Decided by:** William
**Supersedes:** none

## Context
On 16 October Vercel added Web Analytics to the web app (`@vercel/analytics`, `<Analytics />` in the root layout), from turning it on in Vercel's dashboard. Nothing recorded why, and the privacy policy names Vercel only as hosting the website.

Each page view sends the page's full address to Vercel. The brand's invite link carries its token in the address (`/b/{token}`), and that token lets whoever holds it into the deal. Other addresses carry query strings (`?next=`, `?connect=`). CLAUDE.md's security rules keep invite links unguessable and scoped, and keep secrets out of logs.

## Options
1. **Keep it, with addresses cleaned before they are sent.** Page counts for the hackathon's design and use story, at about 1 KB of script. No cookies. The token in `/b/{token}` is replaced with `[token]`, and every query string and fragment is dropped, before anything leaves the browser. The privacy policy says Vercel counts page visits.
2. **Remove it.** Nothing leaves the browser for analytics, and the policy is right as it is. No page counts.
3. **Count visits on AWS instead.** Everything stays on AWS, but it is new backend work for numbers Vercel already gives.

## Decision
Option 1. Vercel Web Analytics stays, counting page views only: no custom events, and nothing about deals, posts, amounts or money. Before a page view is sent, `/b/{token}` becomes `/b/[token]` and the query string and fragment are dropped.

## Consequences
- The privacy policy names Vercel for hosting this website and for counting visits to its pages without cookies (LG-FR-07, LG 1.4).
- Page views sent between 16 October and the fix carried full addresses, invite tokens included. Brand links shared in that time can be replaced with a new link (IN-FR-18) if that matters for a deal.
- A new route that puts a secret in its address must be added to the cleaning.
