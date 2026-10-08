---
name: Cleared
description: Brand deals where the content and the payment clear together.
colors:
  espresso: "#3F3322"
  espresso-deep: "#2C2314"
  espresso-ink: "#1C150A"
  espresso-hover: "#554631"
  latte-line: "#E4DCCE"
  latte: "#F3EEE5"
  latte-wash: "#FAF8F4"
  marigold: "#F5C14B"
  marigold-chip: "#E2B144"
  marigold-ink: "#231A00"
  marigold-ink-2: "#5A4510"
  ink: "#1E1A14"
  ink-2: "#4A4339"
  ink-3: "#675F55"
  ink-4: "#6E665B"
  ground: "#F6F5F2"
  surface: "#FFFFFF"
  line: "#E8E4DC"
  line-soft: "#F1EEE8"
  pass: "#0B6B3A"
  pass-wash: "#DDF4E6"
  fail: "#B8302A"
  fail-wash: "#FFE7E4"
  fail-tint: "#FFF7F6"
  fail-line: "#F5C9C4"
  fail-tint-strong: "#FFEDEA"
  unsure: "#855000"
  unsure-wash: "#FFEFC7"
  waiting: "#5E574D"
  waiting-wash: "#F0EDE7"
  avatar-rose: "#FCE3EC"
  avatar-rose-ink: "#9C2A55"
  avatar-sky: "#DCEBFF"
  avatar-sky-ink: "#1F4E9C"
  avatar-sun: "#FFF0C9"
  avatar-sun-ink: "#7A4D00"
typography:
  logo:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 800
    lineHeight: 1.2
  logo-compact:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.2
  page-title:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  page-title-phone:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  amount:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  amount-phone:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  section-title:
    fontFamily: "Bricolage Grotesque, Figtree, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.25
  item-title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 700
    lineHeight: 1.4
  tab:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 700
    lineHeight: 1.4
  meta:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  chip:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    lineHeight: 1.4
  label:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.02em"
  nav-section:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  bar: "2px"
  xs: "6px"
  sm: "10px"
  nav: "12px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "28px"
  3xl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.surface}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  button-primary-hover:
    backgroundColor: "{colors.espresso-hover}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.pill}"
    padding: "11px 18px"
  button-ghost-hover:
    backgroundColor: "{colors.latte-wash}"
  chip-pass:
    backgroundColor: "{colors.pass-wash}"
    textColor: "{colors.pass}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 4px 8px"
  chip-fail:
    backgroundColor: "{colors.fail-wash}"
    textColor: "{colors.fail}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 4px 8px"
  chip-unsure:
    backgroundColor: "{colors.unsure-wash}"
    textColor: "{colors.unsure}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 4px 8px"
  chip-waiting:
    backgroundColor: "{colors.waiting-wash}"
    textColor: "{colors.waiting}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 4px 8px"
  tab:
    textColor: "{colors.ink-3}"
    typography: "{typography.tab}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  tab-selected:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.surface}"
  money-card:
    backgroundColor: "{colors.marigold}"
    textColor: "{colors.marigold-ink}"
    rounded: "{rounded.lg}"
    padding: "20px 22px 18px"
  money-stage:
    backgroundColor: "{colors.marigold-chip}"
    textColor: "{colors.marigold-ink-2}"
    rounded: "{rounded.pill}"
  money-stage-current:
    backgroundColor: "{colors.marigold-ink}"
    textColor: "{colors.marigold}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  next-step:
    backgroundColor: "{colors.latte-wash}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.lg}"
    padding: "16px 18px 16px 20px"
  chip-checking:
    backgroundColor: "{colors.waiting-wash}"
    textColor: "{colors.waiting}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 4px 8px"
  chip-waiting-for-brand:
    backgroundColor: "{colors.unsure-wash}"
    textColor: "{colors.unsure}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 4px 8px"
  chip-accepted-by-brand:
    backgroundColor: "{colors.waiting-wash}"
    textColor: "{colors.espresso}"
    typography: "{typography.chip}"
    rounded: "{rounded.pill}"
    padding: "4px 10px 4px 8px"
  money-card-released:
    backgroundColor: "{colors.latte}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.lg}"
    padding: "20px 22px 18px"
  deliverable-switcher:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "4px"
  deliverable-switcher-current:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.surface}"
  check-failed-file:
    backgroundColor: "{colors.fail-tint}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  check-failed-ours:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
---

# Design System: Cleared

Recorded from the built design prototype `design/evidence-view/index.html` (6 October 2026). Direction: "Sealed" merged with the "Wallet pass" money card, recoloured to espresso and marigold at William's request (see `.impeccable/surfaces/design-evidence-view-index-html.md`). Extended the same day with the states the creator draft check FRD needs (`docs/specs/creator-draft-check-frd.md`): no draft, checking, waiting for brand, accepted by brand, check failed, fully passing, released, 9:16 drafts and the deliverable switcher. The prototype's state picker shows each one. Product code in `web/` inherits these rules; the prototype itself never ships.

## Overview

**Creative North Star: "Proof earns the seal, the seal releases the money."**

Cleared has to win two people at once. Creators should feel welcomed: the screen is warm, rounded and plain-spoken, and it always says what happens next. Brands should feel they are dealing with a creator who takes the work seriously: the screen reads like a calm, premium finance product, never a hype tool. The world gives the product four things only: an espresso and marigold palette, friendly rounded type, comfortable density, and one signature move, the scalloped seal. Everything else is standard, familiar product UI.

**Key Characteristics:**
- Light, warm-neutral ground under a committed espresso shell (rail, top bar, primary actions, selected tabs).
- Marigold is the money colour: the money card is the brightest thing on the screen.
- Evidence and money on the same screen: the money card sits beside the proof.
- Status colours (green, red, amber, grey) never collide with the brand colours.
- Every status is an icon plus a word inside a seal or chip, never colour alone.
- Plain, warm copy that names the next action.

## Colors

### Primary
- **Espresso** (`espresso`): primary buttons, selected tabs, completed steps, timestamps, focus rings. `espresso-deep` is the rail and top bar; `espresso-ink` is for the darkest marks and video scrims; `espresso-hover` is the hover state of espresso controls. `latte`, `latte-line` and `latte-wash` are its tints for selection, scrubber fill, table headers, hover rows, quoted evidence and the next-step bar.

### Secondary
- **Marigold** (`marigold`): the money card, the logo seal and the current deal step. On marigold, text is `marigold-ink` (headline, current stage) and `marigold-ink-2` (supporting text); upcoming money stages sit on `marigold-chip`.

### Neutral
- **Ground** (`ground`) behind everything, **surface** (`surface`) for panels, `line` and `line-soft` for borders and row rules.
- **Ink** ramp, warm: `ink` for text, `ink-2` for supporting copy, `ink-3` for meta and labels, `ink-4` (AA on ground) for future steps and "after publish".

### State
- **Passed:** `pass-wash` / `pass`. **Fix needed:** `fail-wash` / `fail`, with `fail-tint` and `fail-line` for a failed row or card, and `fail-tint-strong` for a failed grid row when it is hovered or selected, so the selection colour never hides the red signal. **Unsure:** `unsure-wash` / `unsure`. **At live check:** `waiting-wash` / `waiting`.
- **Checking:** `waiting-wash` / `waiting`, with a spinning arc that is static under reduced motion. **Waiting for brand:** `unsure-wash` / `unsure`, because the item is still unresolved. **Accepted by brand:** `waiting-wash` with an `espresso` check-in-circle: settled, but by a person, so never green. **Not checked yet** (no draft): no wash, `ink-4` text, a dot in a `line-soft` seal.
- **Avatars:** `avatar-rose`, `avatar-sky` and `avatar-sun` (each with its `-ink`) tint deal initials in navigation. They identify a deal and carry no status.

### Named Rules
**The Marigold Is Money Rule.** Marigold marks money and progress only: the money card, the logo seal and the current deal step. Never on decoration, never on a button, never as a page wash.

**The Brand Is Not A Status Rule.** Espresso and marigold never stand in for passed, failed, unsure or waiting. Green means passed and nothing else on the screen is green, including an item the brand accepted. The one use of espresso inside a status is the accepted icon, which marks a person's decision rather than a result.

**The Never Colour Alone Rule.** A result is always an icon and a word (check + "Passed", cross + "Fix needed", question + "Unsure", clock + "At live check", arc + "Checking", clock + "Waiting for {brand}", check-in-circle + "Accepted by {brand}"). Colour reinforces; it never carries the meaning by itself.

## Typography

**Faces:** Bricolage Grotesque for the logo, page title, section titles and the amount. Figtree for everything else: navigation, labels, body, data, buttons, chips. All numbers use tabular figures.

### Hierarchy
- `logo` 21px / 800 (`logo-compact` 19px in the top bar).
- `page-title` 30px / 700 (`page-title-phone` 24px): the deliverable name.
- `amount` 38px / 800 (`amount-phone` 34px): the held amount on the money card.
- `section-title` 21px / 700: section headings such as "Checklist".
- `item-title` 18px / 700: the selected checklist item.
- `body` 15px / 400, `body-strong` 14.5px / 700 for item names and buttons, `tab` 13.5px / 700 for filter tabs, `meta` 13px for breadcrumbs, steps and kind lines.
- `label` 12px / 700: field labels in the evidence panel. `nav-section` 11px / 700, uppercase, 0.08em: rail section labels only.

### Named Rules
**The One Voice Rule.** Bricolage is a headline voice. It never appears in labels, buttons, chips, tables or navigation.

## Layout

- **Desktop (1024px and up):** 248px espresso rail, content max 1240px with 36px side padding. Header (breadcrumb, title, meta, deal steps) across the full width. Then two columns (1.35fr / min 340px): left holds the draft player and the next-step bar; right holds the money card and the selected-item evidence panel. The checklist runs full width below.
- **Tablet (768–1023px):** the rail becomes an espresso top bar; one column in this order: money card, player, next-step bar, evidence panel, checklist. The grid drops its Kind and Brief columns under 1000px so nothing scrolls sideways.
- **Phone (under 768px):** 16px gutter. The work comes first: the header (deal steps as a compact dot track, "Step 3 of 7"); a check-failed or passed banner when there is one; one quiet "What happens next" panel (the run summary as a first bold line, then the next step, whose lead links to the first item that needs the creator); the player; the checklist with cards in needs-first order (Fix needed, Unsure, Waiting, then settled items); then the money as a compact row that expands to the full card. The evidence panel folds into expandable item cards. The fixed bottom bar holds only the full-width primary action (48px tall), and is not shown when there is no action; during a check failure it keeps its one action sentence.
- **9:16 drafts (Shorts, Reels):** chosen by the room the page has, not the window, because the rail takes 248px on desktop. With 1060px of content width, three columns: the player (320px), the evidence panel, the money card (300–340px), with the next-step bar under the last two. With 640px, two columns: the player (260–320px) on the left, with the money card, evidence panel and next-step bar stacked on the right. On phones a 9:16 player is at most 60% of the viewport height, centred.
- Rhythm: 20px between major blocks, 24–34px above section headings, 8–14px inside groups.

### Named Rules
**The No Sideways Table Rule.** A data table never scrolls horizontally. AG Grid renders from 768px up and drops secondary columns as it narrows; below 768px the same rows render as cards (`docs/decisions/2026-10-06-evidence-view-ag-grid.md`).

## Elevation & Depth

Mostly flat. Panels use a 1px `line` border with a barely-there shadow. Only two things float: the money card and the phone's fixed next-step bar.

### Shadow Vocabulary
- `panel`: `0 1px 2px rgba(28,21,10,.05)`, with a 1px border.
- `money-card`: `0 2px 4px rgba(120,80,0,.12), 0 14px 32px rgba(120,80,0,.18)`, a warm marigold shadow, no border.
- `floating-bar` (phones): `0 8px 24px rgba(28,21,10,.22)`, white, no border.

### Named Rules
**The Edge Or Lift Rule.** An element gets a defined edge or a soft lift, not both. Bordered panels stay nearly flat; lifted elements drop the border.

## Shapes

Rounded and friendly: 6px for focus rings, 10px for small insets (quotes), 12px for navigation rows and the top-bar button, 14px for media and cards on phones, 20px for panels, the money card and the grid. 2px only for step connector bars. Chips, tabs and buttons are full pills. The one non-round shape is the scalloped seal (14 scallops), drawn as SVG.

## Components

### Buttons
- **Primary:** espresso pill, white text, a small warm shadow; hover lightens to `espresso-hover`; pressed nudges down 1px. Always names its action ("Upload new draft").
- **Ghost:** white pill with a `latte-line` border and espresso text; hover fills `latte-wash`.

### Chips
Result chips are pills with a 14px stroke icon and a word: Passed, Fix needed, Unsure, At live check, Checking, Waiting for {brand}, Accepted by {brand}. In the grid's result column and on cards, an item that changed since the last run carries a small `ink-3` change marker under its chip: a history icon and "Was Fix needed". It is never coloured, because the chip already shows the current status.

### Tabs
A white pill track with 4px padding; the selected tab fills espresso with white text; each tab shows its count. A tab with nothing to show is left out rather than shown at 0 when it is conditional (Waiting for {brand}). On phones the track scrolls sideways instead of wrapping; it is navigation, not a table.

### Deliverable switcher
The same pill track under the page title, one pill per deliverable. Each pill is a link with a platform icon (landscape frame for a video, portrait frame for a Short or Reel), the deliverable name, and its current step on a second line. The current deliverable fills espresso. On phones the row scrolls sideways.

### Cards / Containers
- **Panel:** white, 20px radius, 1px border.
- **Item card (phones):** a button row (seal, name and kind/time, chip) that expands to show the evidence quote, "Play from", the suggested fix, the brief line and how it was checked. Failed cards use `fail-tint` with a `fail-line` border. An Unsure card that the brand declined shows the brand's note in an `unsure-wash` inset above the evidence.
- **Suggested fix:** on Fix needed, Unsure and Waiting items only, when the API sends one. A small ink-3 "Suggested fix" label over one plain sentence, after the evidence and before the brief line. In the card it is a white inset with a `line-soft` border; in the evidence panel it is a field like the others. No colour of its own: on a failed item it must not add more red. Advice, never a promise.
- **Item actions:** an Unsure item offers a ghost "Ask {brand} to accept" with one line saying what the brand will see; a Waiting item offers a ghost "Withdraw" with when it was asked and that it never clears on a timer. Actions sit in the evidence panel (tablet and up) or inside the expanded card (phones), never in a grid cell.
- **Check failed banner:** a full-width panel between the header and the work row, with a seal, a one-line heading naming the file, a sentence on what to do, and a latte pill "Your $1,200 hold is still in place". The file kind (the creator's to fix) uses `fail-tint` with a `fail-line` border and a cross seal. The ours kind (Cleared's to fix) is a plain white panel with a grey refresh seal, because nothing is wrong with the creator's work. The banner holds no button; the next-step bar carries the action.
- **Check stages panel:** while a check runs it takes the evidence panel's place (and sits after the player on phones): "Checking your draft", a meta line (run, started, items done), and the stages as a list of rows with a seal, a name and Done / Now / Next. Done is the deal-step check seal, now is the Checking seal, next is the not-checked seal.
- **No draft:** the player area becomes a quiet `latte-wash` panel (no border of its own) with an ink-4 play-frame mark, "No draft yet" and "Your draft will play here once you upload it." It is deliberately not styled as an upload target (no dashed border, no upload arrow): the upload action is the next-step bar's. A short panel on phones, the post's shape from `md:` up. The timeline is hidden until there is a draft.

### Navigation
Espresso rail with a marigold-seal logo, rail section labels, deal rows with initial avatars and a one-line status ("Brand review · 31h left"). The current page is a lighter fill. On tablet and phone it collapses to an espresso top bar with a "Deals" menu button (44px target).

### Money card (signature)
Marigold card with a large soft white circle in the top-right corner: an espresso-ink lock seal, "Held in PayPal for this video", the amount, PayPal reference and date, a four-stage track (Held → Confirmed → Captured → Paid) where the current stage is an espresso-ink pill with marigold text, and a "Pays out to" footer. It is the one place money appears, and it sits next to the evidence.
- **Released:** when a hold goes back to the brand, the card drops to `latte` with a `latte-line` border and no lift (the Edge Or Lift Rule), the seal becomes a `latte-line` seal with an espresso return arrow, the label reads "Released to {brand}", the reference line gives the date and reason, and the four-stage track becomes a single "Released" stage. Marigold leaves the card because the money is no longer moving towards the creator.

### Money row (phones)
The money card collapsed to one row: a 32px seal (espresso-ink with a marigold lock; latte with a return arrow once released), "$1,200.00 held in PayPal" over "Ref … · Held", and a "Details" toggle that expands the full card beneath. Marigold with the money-card shadow while held; latte with a latte-line border once released.

### Passed banner (signature moment)
When every draft-check item has passed, a white banner with a pass-wash border sits between the header and the content: a 56px pass seal that stamps in once (scale and a small turn, about 400ms, ease-out-expo), "Every item passed", "N items checked against {brand}'s brief. Nothing left to fix.", and a row of 20px item seals that line up in quick sequence. Still under reduced motion. It is the one celebratory moment in the app and it stays calm: no confetti, no marigold.

### Run change banner
What the latest run changed (DC-FR-48), in the banner slot between the header and the work row, built like the check-failed banner: a white panel with a 32/40px seal, a bold heading ("Your fix worked", "Your fix worked, but something changed", "Something changed in this draft"), one sentence per change naming the items, a semibold "1 item still needs you.", and an ink-3 "Below are your results from run 3." A pass-wash border and pass seal when something was fixed and nothing got worse; a line border and a latte seal with a history arrow otherwise. Its seal stamps once (the passed banner's stamp) only when the run lands while the page is open. When every item passes, there is no separate banner: the passed banner adds one semibold pass-coloured line, "Your fix worked: … now passes."

### Seal (signature)
A 14-scallop SVG badge with a stroke icon inside. Green wash + check = passed, red wash + cross = fix needed, amber wash + question = unsure, grey + clock = waiting, espresso-ink + marigold lock = money held, marigold + dot = current step, grey + spinning arc = checking, amber + clock = waiting for the brand, grey + espresso check-in-circle = accepted by the brand, latte + espresso return arrow = money released. Used on timeline markers, grid rows, item cards, deal steps and the logo.

### Evidence timeline
The draft's scrub bar carries a seal marker at every timestamped item (a band for duration items). Selecting a marker, grid row or card moves the playhead and updates the evidence panel in one 200–350ms ease-out move. Items still being checked have no marker; markers appear as their results land. When two markers would sit closer than a tap target (44px) at the timeline's width, the later one lifts to a second row above, joined to its moment by a short latte-line stem; the timeline grows only when that happens, and every item stays one tap. Bands are buttons too: espresso at 30% (50% on hover), solid espresso when selected, with a hit area that reaches below the markers so a band under a marker can still be chosen. Markers and bands are in time order for Tab. The evidence panel and an expanded item card carry a "Play from 3:15" secondary pill (latte-line border, a small play triangle) that jumps the video to the moment, brings it into view and plays it.

### Next-step bar
Latte-wash bar that states what to do and why in one or two sentences, with the primary action. On phones it is fixed to the bottom and holds only the action (no bar when there is none); the words sit on the page as "What happens next": a quiet latte-wash panel above the player (the run summary first, then the lead in bold and the rest), with no icon and no button. While a check-failed banner shows, the bar states only the action, at every width, and the banner explains.

### Brief → checklist
The new-deal flow (docs/specs/creator-brief-checklist-frd.md; design E in design/brief-checklist/option-e.html, with D's item seals) is quiet by intent: colour only where it matters. "New deal" is the marigold button at the top of the rail (espresso in the phone Deals sheet). The new deal page (design C in design/new-deal/option-c.html) has the same crumb and step header as the pages after it, the form in a white card, and from `lg:` a faded, dashed preview of the terms sheet filling in as the creator types, with "How setting up a deal works" (four numbered steps, the current one on a marigold disc) beneath; phones show only the steps, under the form. The checklist screen is two panes from `lg:`: the brief on the left as numbered lines, each with its status in small ink-4 text ("1 item", "Not checked"; only "Question" is unsure-amber), the line the selected item cites tinted marigold; on the right, "N questions to answer" first as white cards with an unsure-wash question seal and outline answer pills, then a tab per post (espresso pill when current) and the items. Each item is a white row with a latte seal and espresso check, its name in bold, and one plain ink-3 line ("Said · Exact match · Line 5"); on phones the brief pane hides and each item adds the line's words in quotes. Items have a ⋯ menu (edit wording, copy or move to another post, remove). "Checklist ready" sits in a latte-wash bar (fixed on phones), greyed until every question is answered. No coloured pills for kinds or checking methods.

### Invite (sponsorship terms sheet)
The invite step (docs/specs/creator-invite-frd.md, design B in design/invite/option-b.html) is the terms the brand will see, edited in place: a white sheet with a 6px marigold top edge and a soft shadow, "Sponsorship terms" in Bricolage, the creator and brand, then a line per post under a 1px ink rule (from `md:` a quiet header row: Post, Days after the hold, Amount). Each line has the post and its folded checklist ("4 checklist items · View"), a − / + day stepper with the example date beneath in ink-3, and the amount right-aligned with a "$" prefix. The total sits in Bricolage at amount weight; the PayPal email and the four payment rules (a plain numbered list) close the sheet. Beside it from `lg:` (below it on phones), "Before you send" ticks items off with latte seals and an empty ring for what is left; "Create link" is the espresso pill, greyed with the first thing left above it, fixed to the bottom on phones. Once the link exists the sheet locks (values as text, "Change terms" in place of "Edit checklist") and the link panel takes the side (top on phones): the link on latte-wash, Copy as the espresso pill, Share outlined where the browser has a share sheet. Confirmations happen in place, never in a modal. No coloured pills; green is not used.

### Brand deal page (confirm and hold)
The brand's page from the invite link (docs/specs/confirm-and-hold-frd.md, design A in design/brand-deal/option-a.html) sits in a slim espresso header (the logo and "{creator} invited {brand}") with no rail. It is the invite's terms sheet read-only, with each post's checklist under its line: a faint latte-line seal per item, the item in bold, "From your brief: “…”" or "Added by {creator}" in ink-3, and where the creator settled an unclear line a latte-wash box ("You wrote … {creator} read it as …"). On phones each checklist folds behind "View all N items", but interpreted, changed and noted items stay in view. "Not on the checklist" and the four payment rules, worded for the brand, close the sheet. "Ask for a change" is an underlined text button; the note opens in place (a white box, latte border, counter "n of 500") and once saved sits on latte-wash with Edit and Remove. Beside the sheet from `lg:` (after it on phones): "Your notes for {creator}" with the outlined send button, then Agree: the summary line above the espresso pill, fixed to the bottom on phones. After agreeing, the holds panel takes the top of the side (top of the page on phones): a line per post with its platform mark, the espresso "Approve with PayPal" pill (greyed while PayPal owes an answer), "Held · … · PayPal ref …" in bold ink, never green, and a declined hold in bold fail red. "Changed" and "Amount changed" are plain text, not pills. In mock builds only, a dashed latte-wash "Demo PayPal" box stands in for PayPal's approval step.

### Brand review (step 5)
The brand's review of one post (docs/specs/brand-review-frd.md, design A in design/brand-review/option-a.html) is the creator's draft check seen from the brand's side, in the brand frame (slim espresso header, no rail). A crumb back to the deal ("{brand} × {creator}"), the post as the title with its platform mark, and one line under it saying what the brand is doing and until when. The player and timeline sit above the checklist panel; each item row has its seal, the item in bold, the status as an icon and a word on the right from `md:` (under the name on phones), the evidence with its underlined timestamp, and "From your brief: “…”" in ink-3. Only Passed is green; "You accepted" is ink with the latte seal; "You objected" and an objection being written are fail red with a flag seal. "Object" is an underlined text button; the objection opens in place (white box, latte border, "n of 500 · required") and once saved sits on latte-wash with Edit and Remove. Beside the work from `lg:`, "Your review" holds the time left in Bricolage, "If you say nothing, the draft is approved.", the saved objections, "Send {n} objections to {creator}" as the espresso pill and "Approve draft" outlined; the hold panel follows ("Held · …" in bold ink). On phones that panel is a dock fixed to the bottom with the time left and both actions. Confirmations open in place on latte-wash, never a modal. The last hour adds "Less than an hour left to object." in bold fail red. On the brand's deal page each held post's line adds where its draft stands in ink-2 (bold when it needs the brand) and "Review draft": the espresso pill for the window, outlined for an ask.

### Publish and pay (the journey)
Past "Approved" (docs/specs/publish-and-pay-frd.md, design B in design/publish-and-pay/option-b.html) the creator's draft check page swaps the money card's four-stage track and the next-step bar for one "From approved to paid" panel. Its header is the money card carried through to Paid (design/publish-and-pay/money-header.html): marigold with the lock seal and the soft white circle while the money moves towards the creator ("Held in PayPal for this Short", "Captured from {brand}"), the amount in Bricolage and the latest PayPal reference and date under it; white with a line border, a latte circle and the marigold Cleared seal once paid ("Cleared", "Paid to {email} · {date}"); latte with no lift if it stopped ("Approved, not paid"). The card lifts with the money-card shadow only while marigold. Below the header, a vertical list of steps joined by a 2px line: Draft approved, the go-ahead, Posted, Live check, Captured, Paid. Done steps carry a latte seal with a check and their time and PayPal reference in ink-3; upcoming steps a faint line-soft seal in ink-3; the current step opens on latte-wash (fail-tint when something needs fixing) with its words, a Bricolage countdown where there is one, and its action (espresso pill; outlined for Send it again). The action also sits in the phone bar. On phones the panel comes first, where What happens next sits. The work (player, checklist) stays beside it. Before Approved, the page keeps the money card and next-step bar. The brand's side carries on in "Your review" (design/publish-and-pay/brand.html): the decision, its silence line in bold, and an inline confirmation.

### Cancel (the card turns over)
Cancelling a post (docs/specs/cancel-frd.md, design B in design/cancel/option-b.html) is a quiet underlined text button under the money card ("Cancel this post"), never a pill; where the post can't be cancelled, one ink-3 line says why instead. Tapping it turns the money card over in place: latte with a latte-line border and no lift, the return seal, "Cancel this post?" in Bricolage, "Would go back to {brand}" (the brand reads "Would come back to you") over the amount, one sentence ending in a bold "This can't be undone.", an optional note (300 characters, a live count) and two actions, "Cancel the post" in the fail colour, the only red on the page, and an outlined "Keep it". On phones the turned card is a full-screen sheet with the actions at the bottom. "Cancel the deal" sits under the side panel of the invite page and the brand's deal page; its confirmation is a card per post, latte for what goes back or closes and white for what stays, with the reason. Afterwards the released card names who cancelled; a deal cancelled before any hold shows a latte "Cancelled before it was held" panel with the other side's note in quotes.

### Sign-in and welcome
The two ways in (docs/specs/sign-in-frd.md) are an espresso "Sign in with Google" pill with the Google mark in a white circle (marigold on the espresso closing band) and an outlined "Try the demo account", side by side from `sm:` and stacked on phones, with the Instagram-only line and the demo note under them. `/sign-in` is the logo, "Sign in to see your deals" and the two buttons, centred on the light ground. The welcome page (design C in design/sign-in/option-c.html) opens "Welcome, {first name}" over the Bricolage headline "Get paid for every brand deal, on time." with "on time" on the marigold highlighter band, then the promise drawn as the deal ahead: three marigold seals (lock, brief, check) on the landing's dashed marigold thread, down the page on phones and across from `lg:`, each with a small uppercase marigold-ink "when", a bold line and one sentence. Below, the "Set up in a minute" card counts "N of 3 done" over a thin marigold bar, with the YouTube and Instagram rows and the PayPal email field, and beside it (under it on phones) "Start your first deal" and an underlined "Skip for now". The creator's name sits at the foot of the rail as a translucent row (marigold initials, name, "Creator" or "Demo account", a chevron) that opens a white menu above it with the email and "Sign out", or "Leave the demo".

### Landing page (Persuade)
The landing at `/` (docs/specs/landing-frd.md, design B2 in design/landing/option-b2.html) uses the same world at a louder volume: the light ground, Bricolage at display size (42px phone, 70px desktop) with "clear together" on a marigold highlighter band, and the product itself as the picture: a phone showing the example deal (a real photo frame of a hand and a serum bottle, timeline seals, three items) with the marigold money card tilted beside it. The problem is a chat on an espresso panel (the creator's marigold bubbles, the brand's translucent ones). How a deal runs is one example deal on a dashed marigold thread: five marigold number seals, each step's words and app panel alternating sides from `lg:`, ending in a pass-coloured CLEARED seal beside held, captured and paid with their PayPal references. The rules carry tilted pass seals; the brand note sits on latte with the lock seal; an espresso closing band holds a marigold button. Motion is CSS: on load the phone's seals pop and a pass seal stamps; on scroll (where supported) the thread draws, number seals stamp, steps slide in from their sides, items settle, the review countdown ticks and CLEARED stamps. All still under reduced motion. No faces in photography, and no real brands.

## Do's and Don'ts

### Do:
- Do put the money and the proof on the same screen.
- Do say what happens next in plain words, including when nothing can happen yet.
- Do show every result as an icon plus a word.
- Do use tabular figures for every amount, time and count.
- Do label synthetic or placeholder content as such.
- Do theme browser surfaces: selection in `latte-line`, espresso focus rings with 2px offset, latte-tinted scrollbars.
- Do show a pointer on every active control (buttons, tabs, selects, links) and `not-allowed` on a disabled or held-back one; set once in the base styles.

### Don't:
- Don't use dark, neon "crypto dashboard" styling.
- Don't use hype styling: loud gradients, emoji, exclamation-heavy copy.
- Don't use rainbow palettes or one colour per item; the world is espresso, marigold and warm neutrals.
- Don't spend marigold on decoration or buttons.
- Don't use green for anything but "Passed".
- Don't scroll a table sideways.
- Don't use Bricolage outside the logo, page title, section titles and the amount.
- Don't put a label or eyebrow above a heading.
