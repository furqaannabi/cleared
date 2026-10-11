# A creator connects Instagram with Instagram Login and one read-only permission

**Date:** 2026-10-11
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none

## Context
PRODUCT.md says a creator connects with Instagram sign-in and that only professional accounts can. Meta offers two ways for a professional account to give an app access, and which one was not chosen.

## Options
1. **Instagram Login.** The creator signs in with Instagram itself. One permission: reading their own profile and media. No Facebook Page is needed. The token lasts 60 days and can be renewed.
2. **Facebook Login.** The creator signs in with Facebook and picks a Page linked to their Instagram account. It needs a linked Page, which many creators do not have, and asks for more than reading media.

## Decision
Option 1.

## Consequences
- The backend runs the connection itself, as it does for Google: the token is exchanged server-side, stored encrypted, never sent to the browser and never logged.
- Only reading is ever asked for. Nothing can be posted, commented or messaged with the access Cleared holds.
- Tokens are renewed by a job before their 60 days end. One that cannot be renewed is lost access, and the creator reconnects.
- CLAUDE.md's and PRODUCT.md's lines on connecting Instagram now say this.
