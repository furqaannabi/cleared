import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { ChecklistPage } from "./checklist-page";

/** The demo deal after Maple & Moss sent notes, back on the checklist page. */
async function onChecklist() {
  await api.openBrandLink("demo_maple");
  await api.sendChanges("deal_maple", [
    { about: { kind: "item", itemId: "it_maple_link" }, text: "Use maplemoss.com/ada-okafor." },
    { about: { kind: "line", briefLine: 5 }, text: "We do need this one." },
    { about: { kind: "deal" }, text: "Could we add a Short?" },
  ]);
  await api.reopenChecklist("deal_maple");
  render(<ChecklistPage dealId="deal_maple" />);
  return screen.findByRole("region", { name: "Maple & Moss asked for 3 changes" });
}

describe("CH-FR-22 the brand's notes on the checklist page", () => {
  test("notes about the deal and brief lines sit at the top; a note about an item sits beside it", async () => {
    const top = await onChecklist();
    expect(within(top).getByText("Could we add a Short?")).toBeVisible();
    expect(await within(top).findByText("“Keep it fun and cosy!”")).toBeVisible();
    expect(within(top).getByText("We do need this one.")).toBeVisible();
    const item = screen.getByText("Use maplemoss.com/ada-okafor.").closest("li");
    expect(item).toHaveTextContent("maplemoss.com/ada in the description");
  });

  test("once the checklist is ready again, the way on is back to the terms, not a fresh invite", async () => {
    await onChecklist();
    await api.markChecklistReady("deal_maple");
    render(<ChecklistPage dealId="deal_maple" />);
    const back = await screen.findByRole("link", { name: "Back to the terms for Maple & Moss" });
    expect(back).toHaveAttribute("href", "/deals/deal_maple/invite");
  });
});
