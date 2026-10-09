# The app and the API share one domain, on two subdomains

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none

## Context
The frontend is on Vercel and the backend on AWS. To a browser those are different sites, so a session cookie set by the backend would be a third-party cookie, which Safari blocks by default and Chrome increasingly restricts. Sessions are HttpOnly cookies by rule, so this has to be solved before any signed-in page can work. William's client calls `/api` on its own address by default and reads the API's address from a setting.

## Options
1. **Through Vercel, at `/api`.** The browser only talks to the frontend's address and Vercel forwards to the backend. Cookies are first-party and no cross-origin set-up is needed. Every call takes an extra hop.
2. **One domain, two subdomains.** The app at one subdomain and the API at another. Browsers treat them as the same site, so cookies work with no proxy and no extra hop. Costs a domain and DNS set-up, and needs cross-origin requests with credentials configured correctly.
3. **Two sites, cross-site cookies.** Nothing to set up, but it relies on third-party cookies and would fail for some visitors.

## Decision
Option 2.

## Consequences
- A domain has to be bought and pointed at both Vercel and AWS before anything is deployed. Furqaan sets it up.
- The API allows credentialed requests from the app's address only, and refuses a changing request whose origin is anything else.
- The session cookie is set by the API's own address and is SameSite=Lax. It is not shared with other subdomains.
- William's client sets `NEXT_PUBLIC_API_BASE_URL` to the API's address. It already sends credentials.
- Google's callback and PayPal's webhook are registered against the API's address.
- Locally the two are two ports on `localhost`, which browsers also treat as one site.
- Shared with William: how the browser reaches the API is part of the contract between the two areas.
