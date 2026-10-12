# Disconnecting deletes Cleared's access, then asks Google to revoke it

**Date:** 2026-10-12
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** none

## Context
A creator can disconnect YouTube or Instagram from Settings, and deleting an account disconnects both. Cleared holds a read-only token for each. Deleting the token stops Cleared reading the account, but the platform still lists Cleared as having access until the creator removes it there.

## Options
1. **Delete, and revoke at Google when it answers.** The stored access is deleted first, always. Google is then asked once to revoke it. If Google fails, the disconnect has still happened. Instagram Login has no revoke call, so its token is only deleted.
2. **Delete only.** Simplest, and no new call. The grant stays listed in the creator's Google account until they remove it.
3. **Revoke must succeed.** The strongest promise, but a Google outage would block disconnecting and deleting.

## Decision
Option 1.

## Consequences
- The Google port gains one call, to Google's revoke address over plain HTTPS. No new library.
- The token is deleted before Google is asked, so a failure never keeps it. The token is never logged.
- Revoking withdraws the whole grant, sign-in included. The creator stays signed in to Cleared, and sees Google's consent screen at their next sign-in.
- An Instagram token that was deleted ends on its own within 60 days. Nothing else can be done for it without a call Meta does not offer.
- Disconnecting is refused while a post on that platform is held and not yet paid or released.
