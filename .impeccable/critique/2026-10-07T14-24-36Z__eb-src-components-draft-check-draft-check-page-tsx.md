---
target: creator draft check page
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-07T14-24-36Z
slug: eb-src-components-draft-check-draft-check-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Phone hides the next step's detail (why / what happens next) |
| 2 | Match system / real world | 3 | Money stage "Confirmed" is unexplained |
| 3 | User control and freedom | 3 | DC-FR-36 (item and tab in the URL) not built: no Back, no deep link |
| 4 | Consistency and standards | 3 | Released page still offers "Needs you 2"; switcher unmarked on demo-only deliverables |
| 5 | Error prevention | 3 | Upload new draft doesn't warn that it clears open asks |
| 6 | Recognition rather than recall | 3 | Fix needed / Unsure items never say what to do |
| 7 | Flexibility and efficiency | 2 | Grid is ~60 Tab stops; no deep links |
| 8 | Aesthetic and minimalist | 3 | Phone first fold has no checklist item; money outweighs the action on desktop |
| 9 | Error recovery | 3 | Phone bar repeats the check-failed banner word for word |
| 10 | Help and documentation | 2 | "Unsure" never explained where it appears |
| | **Total** | **28/40** | Good |

## Design specificity
Authored for Cleared: seals as status and timeline markers, the marigold hold beside the evidence, evidence paired with its brief line, "Checked by". Generic parts: the 7-step stepper, the grid, the plain white phone Deals sheet. Detector: CLI 0 findings. Browser: timeline fill animates width (real, minor); demo-data footnote 179 chars/line (minor); body height transition (false positive); dashed no-draft box inside the player panel (nested card). No overflow, no console errors, no unnamed controls, no contrast failures (closest: money stage labels 4.62:1), 44px targets everywhere.

## Priority issues
- [P1] Phone hides the why of every next step (next-step detail is md: only). Fix: show the detail on phones in the page. /impeccable clarify
- [P1] Fix needed and Unsure items don't say what to do. Fix: a "To fix" line; the API must supply it (request for Furqaan). /impeccable clarify
- [P1] A successful re-run is the quietest moment: no "your fix worked" summary, selection doesn't move to what still needs you, and (mock) a now-passing item keeps its old failing evidence. /impeccable delight + harden
- [P2] DC-FR-36 URL state missing; grid is ~60 Tab stops. /impeccable harden
- [P2] Wrong states: grid Time says "After publish" for draft-check items with no time yet; released shows "Needs you"; no-draft placeholder looks like an upload target but isn't. /impeccable polish

## Persona red flags
- Mid-size creator on a phone: fold is chrome; fixed bar sits over the 9:16 video; one-line lead is all the explanation; filter tabs clip.
- First-time creator: Unsure, At live check, "Worked out from the timestamps" and "Confirmed" unexplained; unclear whether uploading undoes an ask.
- Power user on desktop: 60 Tabs through the grid; no deep link; no shortcut to next item.

## Minor
Plain white phone Deals sheet; expanded money row repeats amount and ref; checking state empties the timeline; seals crowd at 375; failed-ours banner icon looks like a button; money track shows one reference, not one per stage; passed banner mini seals are noise.

## Questions
1. While a draft needs fixing, should the marigold money card be the brightest thing on screen?
2. If the creator lives on the phone, why does the phone get less explanation than desktop?
3. A successful fix is the emotional peak of the page. Why is it the quietest moment?
