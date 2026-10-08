# The brand asks for changes; the creator makes them

**Date:** 2026-10-08
**Status:** Accepted
**Decided by:** William (Furqaan can supersede)
**Supersedes:** none

## Context
PRODUCT.md step 3 says "The brand reviews the checklist and can edit it. Once both sides accept the same checklist, amounts and release rule, the brand approves one PayPal hold per deliverable." The signed invite FRD (IN-BR-03) says the link carries one locked set of terms and "the brand can only approve the terms the creator set." The two disagree on who writes the checklist. This is shared product behaviour; William decided so the confirm and hold step can be specified.

## Options
1. **The brand edits directly.** The brand changes, adds or removes items, then the creator accepts the changes before any hold. Needs an editor and a change view on both sides and a back-and-forth loop; breaks IN-BR-03.
2. **The brand asks for changes; the creator makes them.** The brand writes a short note on any item, line left out, amount or deadline (plus one note for the whole deal) and sends them together. The creator edits with the editor that already exists and sends updated terms. One author for the checklist; the brand only ever agrees to terms the creator wrote.
3. **Agree or decline only.** One free-text reason on decline. Simplest, but the brand can't point at what's wrong.

## Decision
Option 2. "Can edit" in PRODUCT.md step 3 works through change requests: the brand asks, the creator changes, and both sides still accept the same checklist.

## Consequences
- The confirm and hold FRD (CH) specifies the brand's notes, the creator's response and "Send updated terms".
- The link stays the same through a change request and the terms are versioned (CH); the invite FRD gains a revision pointing to CH.
- The backend needs a change-notes endpoint, a `changes_requested` step and terms versions (CH Requests for Furqaan).
- PRODUCT.md step 3 points at this record.
