# Visual world is set by a design prototype in design/

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
`CLAUDE.md` says no code without a signed spec, and visual work starts with `/impeccable`. `/impeccable` does not write `DESIGN.md` up front: it picks a direction with the human, builds a first screen, reviews it, and writes `DESIGN.md` from what was built. The frontend stack is not decided yet, and no spec exists.

## Options
1. **Prototype in `design/`.** A static prototype outside `web/`, exempt from the spec and TDD rules. Its outputs are `DESIGN.md` and the direction contract; product code is built later from signed specs.
2. **Spec first, then design.** Write and sign the first screen's spec and pick the frontend stack, then let `/impeccable` build it in `web/`. Slower to reach a visual direction, and the stack decision gets made before the design is known.

## Decision
Option 1. The first screen is the evidence view (draft check results).

## Consequences
- `design/` holds design prototypes only. Nothing in it ships, and `web/` never imports from it.
- The prototype is exempt from the spec and TDD rules. Every other `CLAUDE.md` rule still applies, including security, mobile-first, domain language and no invented product behaviour.
- `DESIGN.md` and `.impeccable/design.json` are written from the built prototype; specs and `web/` inherit them.
- Data in the prototype is labelled synthetic.
