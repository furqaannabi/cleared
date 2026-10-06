---
version: 1
slug: "design-evidence-view-index-html"
primary_target: "design/evidence-view/index.html"
related_targets: []
---

Scope: evidence view (draft check results) for one deliverable. Mode: Operate. Prototype in design/, not product code.

Audience: the creator first (phone, between edits), the brand second (laptop, reviewing). Job: see, item by item, what the draft passed, failed or was unsure about, with the timestamp and brief line, and know what happens to the money next.

Constraints: PRODUCT.md rules (AI never moves money; unsure never clears on a timer). AG Grid on md+, cards below (ADR 2026-10-06-evidence-view-ag-grid). Domain language from CLAUDE.md. Synthetic data, labelled.

User steer: playful and inviting but must still read as finance so brands see the creator as serious; not busy; no crypto/neon dashboard; no influencer hype. Reference for warmth: passionfroot.me. Chosen: "Sealed" direction merged with the "Wallet pass" money card.

## Direction contract

THESIS: Proof earns the seal, the seal releases the money. Refuses the category default of a grey table of status pills beside a separate payments widget: evidence and money read as one story.

OWN-WORLD: Espresso shell (#2C2314 rail, #3F3322 actions) on a warm-neutral ground; marigold (#F5C14B) is the money colour, carried by the money card (wallet-pass form: amount, PayPal ref, held → confirmed → captured → paid track) and the current step. Scalloped seal badges mark checked items. Status colours stay separate from the brand. Rounded friendly sans (Figtree) for UI, Bricolage Grotesque only for the logo, headings and the amount. (Recoloured from money green at William's request, 6 Oct.)

STORY: The creator sees at a glance that $1,200 is safely held, which items passed with proof, the one thing to fix and the one a person will decide, then uploads a new draft. A brand sees a creator who delivers against the brief.

FIRST VIEWPORT: Left rail (deals). Header across the top: deal and deliverable, meta, deal steps. Below, two columns: left the draft player with seal markers on its scrub bar at each evidence timestamp, and the next-step bar with the primary action "Upload new draft"; right the money card above a selected-item evidence panel (transcript or on-screen text, brief line, result). Evidence grid (AG Grid) below; selecting a row moves the playhead and the panel. On phones: pass card, player, next-step bar, item cards.

FORM: Sealed (certificates and award rosettes), merged with Wallet pass; position 6 on the round-3 list; seed key cbb7511a (reroll 2, degraded roll).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
