import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { ChecklistItems } from "./checklist-items";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));

function screenWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(min-width: 768px)" ? px >= 768 : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("DC-FR-40 grid on md: and up, cards below", () => {
  test("a phone gets item cards, never the grid", () => {
    screenWidth(375);
    render(<ChecklistItems items={view.items} brandName="Glow Theory" selectedId="it_5" onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /Code GLOW20 shown on screen/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("grid")).toBeNull();
  });

  test("a tablet or desktop gets the grid", async () => {
    screenWidth(1280);
    render(<ChecklistItems items={view.items} brandName="Glow Theory" selectedId="it_5" onSelect={() => {}} />);
    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Code GLOW20 shown on screen/ })).toBeNull();
  });
});
