import type { Deliverable } from "@/lib/deliverable/types";

/*
 * The landing page's example deal (LP-BR-03): synthetic, labelled on the page,
 * written here so nothing from src/mocks/ ships in production. The names match
 * the demo's Glow Theory deal.
 */

/** The held money for the example deliverable, shaped for the app's MoneyCard. */
export const exampleDeliverable: Deliverable = {
  id: "example",
  brandName: "Glow Theory",
  platform: "youtube_video",
  state: "results",
  deadline: "2026-10-24T23:59:00Z",
  creatorTimeZone: "UTC",
  items: [],
  hold: { amountMinor: 120000, currency: "USD", reference: "7HK21934LM", heldAt: "2026-10-03T10:00:00Z", stage: "held" },
  payoutEmail: "ada@example.com",
};

/** The three checklist items the page shows, with their results. */
export const exampleItems = [
  { name: "Mentions Glow Theory in the first 60 seconds", short: "Mentions Glow Theory", meta: "Said · 0:42", status: "passed" },
  { name: "Glow Theory logo on screen for 3+ seconds", short: "Logo on screen 3+ s", meta: "Shown · 1:10", status: "passed" },
  { name: "Code GLOW20 shown on screen", short: "Code GLOW20 on screen", meta: "Shown as text · 3:15", status: "fix_needed" },
] as const;

/** Step 1: checklist items and the brief lines they came from. */
export const exampleChecklist = [
  { text: "Say “Glow Theory” in the first 60 seconds", line: 2 },
  { text: "Show the logo for 3+ seconds", line: 4 },
  { text: "Say and show the code GLOW20", line: 5 },
];

/** Step 5: each money stage with its PayPal reference (illustrative). */
export const examplePayout = [
  { stage: "Held", reference: "7HK21934LM" },
  { stage: "Captured", reference: "3CX84211" },
  { stage: "Paid to you", reference: "9PO55120" },
];
