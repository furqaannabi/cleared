import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { ItemCardList } from "./item-card-list";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));

function Harness() {
  const [selected, setSelected] = useState<string | null>("it_5");
  return <ItemCardList items={view.items} brandName="Glow Theory" selectedId={selected} onSelect={setSelected} />;
}

const row = (name: string) => screen.getByRole("button", { name: new RegExp(name) });

test("DC-FR-22: the open card is the selected item; opening another closes it", async () => {
  render(<Harness />);
  expect(row("Code GLOW20 shown on screen")).toHaveAttribute("aria-expanded", "true");
  expect(row("Serum shown in use")).toHaveAttribute("aria-expanded", "false");

  await userEvent.click(row("Serum shown in use"));
  expect(row("Serum shown in use")).toHaveAttribute("aria-expanded", "true");
  expect(row("Code GLOW20 shown on screen")).toHaveAttribute("aria-expanded", "false");

  await userEvent.click(row("Serum shown in use"));
  expect(row("Serum shown in use")).toHaveAttribute("aria-expanded", "false");
});
