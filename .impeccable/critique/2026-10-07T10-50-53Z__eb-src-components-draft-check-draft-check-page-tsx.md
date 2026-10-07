---
target: creator draft check page
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-10-07T10-50-53Z
slug: eb-src-components-draft-check-draft-check-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Check failed shows the previous run's results with no banner; the page reads as two states |
| 2 | Match system / real world | 4 | Plain, specific language throughout |
| 3 | User control and freedom | 3 | Withdraw undoes an ask; item and tab not in the URL (DC-FR-36), so Back does nothing useful |
| 4 | Consistency and standards | 3 | Timestamps seek only from timeline markers; DC-FR-23 says anywhere |
| 5 | Error prevention | 3 | Released still shows "Needs you 2" filters on a read-only deliverable |
| 6 | Recognition rather than recall | 2 | Phone bar hides its detail: deadline, hold reassurance, waiting item |
| 7 | Flexibility and efficiency | 2 | Range bands not focusable; no deep links; phone list not problems-first |
| 8 | Aesthetic and minimalist design | 3 | Desktop strong; phone spends 1.5 screens on money and video before any result |
| 9 | Error recovery | 2 | On phones the check-failed reassurance is cut; not-found has no way forward |
| 10 | Help and documentation | 2 | Unsure, Confirmed, Captured, "run 2" unexplained |
| **Total** | | **27/40** | **Acceptable** |

## Design Specificity Verdict
Authored, not generic: espresso and marigold, the scalloped seal across status, steps, markers and logo, the wallet-pass money card beside the proof. Desktop at 1440 is close to the prototype. Weaker on phones, where it becomes a generic stack, and in the special states DESIGN.md defines but the build lacks.
Deterministic scan: CLI detector clean (0 findings). In-page detector: skipped-heading on 5/5 pages (real: evidence panel h3 before the Checklist h2 at 1440); layout-transition width on the timeline fill (real, minor); layout-transition height from AG Grid's own CSS (false positive). axe: 0 violations at 375; at 1440 heading-order (same as above) and empty-table-header on the grid's seal column. Mechanical: no overflow, no console errors, no unnamed controls; the brand crumb link is 18px tall at 1440; unselected filter counts are about 3.96:1 contrast (opacity-80).

## Priority Issues
- [P0] Check failed has no banner and contradicts itself. DESIGN.md and DC-FR-08/09 define a full-width banner with a "Your $1,200 hold is still in place" pill; the build shows stale Fix needed evidence and, on phones, cuts the hold reassurance (fails DC-FR-28). Fix: build the banner (file and ours kinds) between header and content, hold pill inside, mark old results "From run 2". /impeccable harden
- [P1] Phone order buries the work: money card and video fill the first 1.5 screens; the item to fix is ~1,300px down; the fixed bar covers the timeline. Fix: problems-first card order, bar lead taps through to the first Needs you item, scroll padding under the bar, possibly a compact money row on phones. /impeccable layout
- [P1] Missing state treatments: no-draft player placeholder, checking stages panel, a fully passing peak (the product's best moment is its least designed), and the on-screen synthetic-data label (DC-BR-10). /impeccable harden, /impeccable delight
- [P2] Timestamps and bands not interactive (DC-FR-23, DC-FR-24): time text everywhere should seek; bands should be named buttons. /impeccable harden
- [P2] Accessibility details: heading order at 1440 (h1 then h3), empty grid header for the seal column, no live announcement after Ask, no skip link past the rail, grid rows select on click only, filter count contrast, 18px crumb link. /impeccable audit

## Persona Red Flags
Casey (mobile creator): opens between edits and sees money and video, not what failed; "Fix 2 items" has no tap-through; after Ask the bar forgets the waiting item; check-failed reassurance invisible.
Sam (screen reader / keyboard): no skip link; bands unreachable; Ask result not announced and focus lands nowhere defined; grid keyboard selection unverified; heading skip on desktop.
Jordan (first-timer): Confirmed and Captured unexplained; Unsure and "AI, with a timestamp" unexplained; not-found has no "Back to your deals".

## Minor Observations
Released deliverable missing from the switcher (mock data); timeline ticks at odd quarters (1:42, 3:24); brief sheet could name the item citing the highlighted line; at 900px the 16:9 player fills the viewport; "Fix 2 items" lumps Unsure with Fix needed, steering away from the ask path.

## Questions to Consider
On a phone, should what failed lead, with money shrinking to a one-line "$1,200 held"? What should the seal do the first time a draft fully passes? Should Unsure be presented as a choice ("fix it or ask Glow Theory") instead of counted in "Fix N items"?
