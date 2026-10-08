import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { describeStatus } from "@/lib/checklist/item-status";
import { itemTime } from "@/lib/checklist/item-labels";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import ChecklistGrid from "./checklist-grid";
import { ItemCard } from "./item-card";

const BRAND = "Glow Theory";
const named = (name: string) => new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));

// DC-FR-41: the grid (md: and up) and the cards (phones) come from one source
// and show the same status, brief line, evidence and timestamp for every item.
test("DC-FR-41: grid rows and item cards show the same thing for every item", async () => {
  const { unmount } = render(
    <ChecklistGrid items={view.items} brandName={BRAND} selectedId={null} onSelect={() => {}} wide />,
  );
  await screen.findAllByRole("row", { name: named(view.items[0].name) });
  const gridText = new Map(
    view.items.map((item) => [item.id, screen.getAllByRole("row", { name: named(item.name) })[0].textContent ?? ""]),
  );
  unmount();

  for (const item of view.items) {
    const { container, unmount: unmountCard } = render(
      <ul>
        <ItemCard item={item} brandName={BRAND} expanded onToggle={() => {}} />
      </ul>,
    );
    const card = within(container).getByRole("listitem").textContent ?? "";
    const grid = gridText.get(item.id) ?? "";
    const expected = [
      describeStatus(item.status, BRAND).label,
      item.evidence?.text,
      itemTime(item),
      item.briefLine ? String(item.briefLine.number) : "Added by you",
    ].filter((x): x is string => Boolean(x));
    for (const piece of expected) {
      expect(grid, `grid ${item.id}: ${piece}`).toContain(piece);
      expect(card, `card ${item.id}: ${piece}`).toContain(piece);
    }
    unmountCard();
  }
});
