# Frontend stack for web/: Tailwind, Radix, Motion, Vitest and Playwright

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
`CLAUDE.md` leaves four frontend choices open, all William's to make: the UI kit, styling, motion, and frontend test tooling. The visual world is already set in `DESIGN.md` from the evidence-view prototype (espresso and marigold, the scalloped seal, the money card), so the stack has to reach that look rather than bring its own. The evidence table and brand dashboard render in AG Grid on `md:` and up and as cards below (`2026-10-06-evidence-view-ag-grid.md`), so both renderings need the same tokens. `CLAUDE.md` already writes its mobile-first rules as `sm:`/`md:` utility classes. Design is one of five equally weighted judging criteria.

## Options
1. **Tailwind v4, Radix UI primitives, Motion, Vitest with React Testing Library and Playwright.** `DESIGN.md` tokens become Tailwind `@theme` variables that AG Grid's Theming API can also read. Radix is unstyled, so `DESIGN.md` stays the only visual source, and it brings accessible dialogs, accordions and tabs. Motion handles card expansion to `auto` height on iOS Safari and the coordinated playhead and panel move, with reduced-motion support. Costs: long class strings; about 5–15 KB per Radix primitive; about 15 KB for Motion with `LazyMotion`.
2. **CSS Modules, React Aria Components, CSS-only motion, same test tooling.** Closest to the prototype's CSS, with no styling dependency and the strongest accessibility. Costs: `CLAUDE.md`'s `sm:`/`md:` rules would need rewording; React Aria is heavier (about 40 KB+ shared); coordinated and exit motion gets fiddly in CSS.
3. **Mantine, its built-in transitions, Jest via `next/jest`.** Fastest to forms, modals and date pickers. Costs: Mantine brings its own look and would be overridden constantly to reach `DESIGN.md`, risking a generic result on a judged criterion; heavier bundle.

## Decision
Option 1. Tailwind v4 for styling, Radix UI primitives wrapped in `src/components/ui/`, Motion (`motion/react`) for motion, and Vitest with React Testing Library for components plus Playwright for end-to-end and 375px checks.

## Consequences
- `CLAUDE.md` "Not yet decided" rows for UI kit, styling, motion and frontend test tooling move into the Tech Stack table.
- `DESIGN.md` tokens are defined once as CSS variables in the Tailwind theme. AG Grid's theme reads the same variables; no colour is hard-coded in a component.
- Tailwind breakpoints stay at their defaults, as `CLAUDE.md` already requires.
- Radix primitives are installed one at a time as a component needs them, each justified in its commit. Nothing is imported from `design/`.
- Motion is loaded through `LazyMotion`; every animation honours `prefers-reduced-motion`.
- Async Server Components cannot be rendered in Vitest, so those pages are covered by Playwright. Coverage (≥ 70%) is measured with Vitest's v8 provider.
- Exact versions are pinned when `web/` is scaffolded. Scaffolding waits on the package manager and repo layout decision, which needs both William and Furqaan.
