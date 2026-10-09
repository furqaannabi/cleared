# An invite link is worked out again each time, never stored

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
The deal set-up spec says two things about the brand's link that cannot both hold as written (DS-FR-32, DS-BR-11): the backend keeps only a hash of the link, and the creator's page can fetch the link again while it is live. A hash cannot be turned back into the link, and William's invite page shows the link on every visit. This came up when the invite was built.

## Options
1. **Work it out again.** Keep the hash and a random salt for each link. The link's token is computed from the salt and a key the service holds, each time the creator asks. Nothing of the link is stored, and a copy of the database alone gives no working link. The service needs that key to start.
2. **Store it encrypted.** Keep the hash and the token encrypted through the secrets port. The same protection against a copied database, but a form of the link is kept, which reads against "never the link itself", and every fetch is a call to KMS once deployed.
3. **Show it once.** Keep the hash only. The link is returned when it is made or replaced and never again; to see it again the creator makes a new one, which turns the old one off. The strictest, but it changes DS-FR-32 and the invite page.

## Decision
Option 1.

## Consequences
- An invite link's row holds a random 32-byte salt and the SHA-256 hash of its token. The token is HMAC-SHA-256 of the salt, under a key derived from `TOKEN_KEY` for this one purpose, so it is not the key that encrypts Google's tokens.
- `TOKEN_KEY` is now required for the API to start, with or without Google. Before, it was needed only once Google was set.
- Changing `TOKEN_KEY` turns off every link made before the change: the tokens it gives no longer match their hashes. Creators would make new links.
- Working the token out sits behind a small port, as encrypting does. In production it is to be backed by AWS KMS, which can sign with a key that never leaves it; that arrives with the deployment spec.
- The brand's way in looks a link up by the hash of the token it is sent, as planned. Nothing about that changes.
- DS-FR-32 and DS-BR-11 need their wording brought in line: what is kept is the hash and the salt.
