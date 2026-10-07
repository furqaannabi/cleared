import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { DraftTimeline } from "./draft-timeline";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));

describe("DC-FR-24 draft timeline", () => {
  test("a named seal marker for every item with a single timestamp, a band for each time range", () => {
    render(<DraftTimeline items={view.items} brandName="Glow Theory" durationSec={408} selectedId={null} onSelect={() => {}} />);
    const markers = screen.getAllByRole("button");
    expect(markers.map((m) => m.getAttribute("aria-label"))).toEqual([
      "Mentions Glow Theory in the first 60 seconds, Passed, at 0:42",
      "Sponsored segment runs at least 45 seconds, Passed, at 0:42–1:38",
      "Glow Theory logo on screen for 3+ seconds, Passed, at 1:10",
      "Says discount code GLOW20, Passed, at 2:06",
      "Code GLOW20 shown on screen, Fix needed, at 3:15",
      "Serum shown in use, Unsure, at 4:02",
    ]);
    expect(screen.getByTestId("band-it_2")).toHaveStyle({ left: `${(42 / 408) * 100}%` });
  });

  test("DC-FR-22: choosing a marker selects its item, and the selected marker is pressed", async () => {
    const onSelect = vi.fn();
    render(<DraftTimeline items={view.items} brandName="Glow Theory" durationSec={408} selectedId="it_5" onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /Code GLOW20 shown on screen/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /Serum shown in use/ }));
    expect(onSelect).toHaveBeenCalledWith("it_6");
  });

  test("DC-FR-24: choosing a band selects its item", async () => {
    const onSelect = vi.fn();
    render(<DraftTimeline items={view.items} brandName="Glow Theory" durationSec={408} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /Sponsored segment runs at least 45 seconds/ }));
    expect(onSelect).toHaveBeenCalledWith("it_2");
  });
});
