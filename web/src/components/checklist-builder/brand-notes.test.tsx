import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { aReadDraft, stubDealDraft } from "@/test/deal-draft";
import { ChecklistPage } from "./checklist-page";

/** Glow Theory's deal after the brand sent notes about an item, a brief line and the deal, back at the checklist. */
const withNotes = (d: Parameters<typeof aReadDraft>[0] = {}) =>
  aReadDraft({
    questions: aReadDraft().questions.map((q) => ({ ...q, answer: { kind: "left_out" as const } })),
    notes: [
      { id: "note_code", about: { kind: "item", itemId: "it_glow_code_v" }, text: "Use the code GLOW25 instead.", version: 1 },
      { id: "note_fun", about: { kind: "line", briefLine: 5 }, text: "We do need this one.", version: 1 },
      { id: "note_short", about: { kind: "deal" }, text: "Could we add a Short?", version: 1 },
    ],
    ...d,
  });

describe("CH-FR-22 the brand's notes on the checklist page", () => {
  test("notes about the deal and brief lines sit at the top; a note about an item sits beside it", async () => {
    stubDealDraft(withNotes());
    render(<ChecklistPage dealId="deal_glow" />);
    const top = await screen.findByRole("region", { name: "Glow Theory asked for 3 changes" });
    expect(within(top).getByText("Could we add a Short?")).toBeVisible();
    expect(await within(top).findByText("“Keep it fun and authentic!”")).toBeVisible();
    expect(within(top).getByText("We do need this one.")).toBeVisible();
    const item = screen.getByText("Use the code GLOW25 instead.").closest("li");
    expect(item).toHaveTextContent("Says the code GLOW20");
  });

  test("once the checklist is ready again, the way on is back to the terms, not a fresh invite", async () => {
    stubDealDraft(withNotes({ step: "changes_requested", ready: true }));
    render(<ChecklistPage dealId="deal_glow" />);
    const back = await screen.findByRole("link", { name: "Back to the terms for Glow Theory" });
    expect(back).toHaveAttribute("href", "/deals/deal_glow/invite");
  });
});
