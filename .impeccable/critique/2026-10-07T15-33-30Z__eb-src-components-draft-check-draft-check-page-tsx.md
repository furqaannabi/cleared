---
target: creator draft check page
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-07T15-33-30Z
slug: eb-src-components-draft-check-draft-check-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | While checking, cards keep the previous run's evidence and Play from |
| 2 | Match system / real world | 3 | Money stage "Confirmed" unexplained; "Worked out from the timestamps" is system language |
| 3 | User control and freedom | 3 | Upload starts a run on file choice, no confirm or cancel |
| 4 | Consistency and standards | 3 | Selected item vanishes from a filtered grid but stays in the panel |
| 5 | Error prevention | 2 | No pre-check of format/length before a run is spent |
| 6 | Recognition rather than recall | 3 | Grid shows "Line 5" only |
| 7 | Flexibility and efficiency | 2 | No jump to the next item that needs you; video controls take 5 Tab stops |
| 8 | Aesthetic and minimalist | 3 | Phone: the What happens next panel and the fixed bar repeat the same lead |
| 9 | Error recovery | 3 | Released ends on a red card with a Suggested fix that can't be acted on |
| 10 | Help and documentation | 2 | Unsure, declines, the review window and money stages unexplained |
| | **Total** | **27/40** | Acceptable (top) |

## Design specificity
Authored for Cleared (seals, money beside proof, evidence timeline, specific copy). Generic: AG Grid table, the stepper's uneven connectors, the white phone Deals sheet. Detector: CLI 0; browser: demo footnote line length (real, minor), run-change line length (borderline), AG Grid's own height transition (false positive). 0 overflow, 0 console errors on load, 0 unnamed controls outside AG Grid, 0 contrast failures, all targets 44px. Grid seal cells are empty to screen readers. Phone reading order differs from visual order on landscape pages (player read before money). Grid is one Tab stop; ~28 Tab stops per page.

## Priority issues
- [P1] Bug: after a simulated upload, React logs "Cannot update a component while rendering a different component": the URL reset runs during render (regression from DC-FR-36). /impeccable harden
- [P1] Phone first screen is all summary: run banner, money row, What happens next, and a fixed bar repeating the panel (and a button-less fixed bar in brand review and released). /impeccable distill, layout
- [P1] Desktop: the run banner pushes the next step and Upload below the fold at 1440x900. /impeccable layout
- [P2] Checking shows the previous run's evidence as current. /impeccable harden
- [P2] Released ends on a red Fix needed card with a Suggested fix. /impeccable clarify
- [P2] Mock brief citation wrong: "Names the Dew Drop serum clearly" cites line 6 (showing it on skin). /impeccable harden

## Persona red flags
- Creator on a phone: summary before work; fixed bar covers the 9:16 player in brand review; filter tabs clip.
- First-time creator: money stages, Unsure, declines and publishing after review unexplained.
- Keyboard user: no next-needs-you jump; filter tabs aren't a tablist.

## Minor
Switcher unmarked on demo-only deliverables; uneven step connectors; faint Not checked seal; "Below are your results from run 2" repeats the header; Details repeats the amount; tall empty 9:16 no-draft panel on desktop; "Needs you 0" next to a passed banner; stark white sheets; upload focus ring flickers white.

## Questions
1. Should the first failing item, its fix and Upload come first on a phone, above the money and the recap?
2. Should the money card say how close the creator is to being paid?
3. What does a confident fully passing state look like (when you can publish, how money follows)?
