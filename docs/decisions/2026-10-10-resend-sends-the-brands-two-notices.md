# Resend sends the brand's two notices, in place of Amazon SES

**Date:** 2026-10-10
**Status:** Accepted
**Decided by:** Furqaan (William to agree)
**Supersedes:** the choice of Amazon SES in [Email for the brand's two notices after publishing](2026-10-10-email-for-the-brands-two-notices-after-publishing.md). Everything else in that record stands: which two notices, to which address, in what order, and that nothing else is emailed.

## Context
The brand is emailed at two moments after a post is live, and Amazon SES was chosen to send them. Before the email port was built, Furqaan chose Resend instead. SES delivers only to verified addresses until AWS grants an account production access, which is a request AWS reviews.

## Options
1. **Resend.** One HTTPS call with an API key. It delivers to any address once a sending domain is verified. It is not an AWS service or a sponsor's tool, so it is the first service behind the frontend that is neither.
2. **Amazon SES, as decided.** Stays inside AWS and the service's existing credentials. Delivers only to verified addresses until production access is granted.

## Decision
Option 1.

## Consequences
- The email port's real adapter calls Resend's API over plain HTTPS, as Google and YouTube are called. No library is added, and AWS's SES client is not.
- A new secret, the Resend API key, kept server-side in the environment like the others, and never logged.
- A brand's email address and the link in its notice pass through Resend. Neither is logged by Cleared.
- A sending domain has to be verified with Resend before a real brand can be emailed. Until then Resend's test sender delivers only to the account owner's own address, which is enough to prove the port and not for a demo to someone else.
- PRODUCT.md and CLAUDE.md said everything behind the frontend uses AWS or the hackathon's sponsor tools. Both now name this one exception. The hackathon's own rule is PayPal and AI, so eligibility is unchanged.
- To verify while building: Resend's sending limits on the plan in use, and what the notice looks like in a real inbox.
