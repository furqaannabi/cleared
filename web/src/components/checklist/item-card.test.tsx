import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SeekProvider } from "@/components/player/seek";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { ItemCard } from "./item-card";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));
const byId = (id: string) => view.items.find((i) => i.id === id)!;

describe("DC-FR-12 item card", () => {
  test("collapsed: the seal, name, kind and time, and the result", () => {
    render(<ItemCard item={byId("it_5")} brandName="Glow Theory" expanded={false} onToggle={() => {}} />);
    const button = screen.getByRole("button", { name: /Code GLOW20 shown on screen/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(within(button).getByText("Shown as text · 3:15")).toBeVisible();
    expect(within(button).getByText("Fix needed")).toBeVisible();
  });

  test("expanded: the evidence, the brief line it came from, and how it was checked", () => {
    render(<ItemCard item={byId("it_5")} brandName="Glow Theory" expanded onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: /Code GLOW20 shown on screen/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Reads “GLOW2O”, with a letter O where the zero should be.")).toBeVisible();
    expect(screen.getByText("Brief line 5: “Say and show the code GLOW20.”")).toBeVisible();
    expect(screen.getByText("Checked by: Exact match")).toBeVisible();
  });

  test("DC-FR-19: an expanded card shows what changed since the last run", () => {
    render(<ItemCard item={byId("it_4")} brandName="Glow Theory" expanded onToggle={() => {}} />);
    expect(screen.getByText("Was Fix needed")).toBeVisible();
  });

  test("tapping the row asks to open or close it", async () => {
    const onToggle = vi.fn();
    render(<ItemCard item={byId("it_5")} brandName="Glow Theory" expanded={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: /Code GLOW20 shown on screen/ }));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  test("DC-FR-23: an expanded card's timestamp plays the draft from that moment", async () => {
    const seek = vi.fn();
    render(
      <SeekProvider seek={seek}>
        <ItemCard item={byId("it_2")} brandName="Glow Theory" expanded onToggle={() => {}} />
      </SeekProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Play from 0:42" }));
    expect(seek).toHaveBeenCalledWith("it_2");
  });
});
