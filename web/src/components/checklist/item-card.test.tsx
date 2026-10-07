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

  test("DC-FR-46: an expanded card shows the suggested fix after the evidence and before the brief line", () => {
    const hint = "Change the on-screen code to GLOW20, with a zero, not the letter O.";
    render(<ItemCard item={{ ...byId("it_5"), suggestedFix: hint }} brandName="Glow Theory" expanded onToggle={() => {}} />);
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const label = screen.getByText("Suggested fix");
    expect(screen.getByText(hint)).toBeVisible();
    expect(follows(screen.getByText("Reads “GLOW2O”, with a letter O where the zero should be."), label)).toBe(true);
    expect(follows(label, screen.getByText("Brief line 5: “Say and show the code GLOW20.”"))).toBe(true);
  });

  test("DC-FR-46: collapsed, the card does not show the suggested fix", () => {
    render(<ItemCard item={{ ...byId("it_5"), suggestedFix: "Change the code." }} brandName="Glow Theory" expanded={false} onToggle={() => {}} />);
    expect(screen.queryByText("Suggested fix")).toBeNull();
  });

  test("DC-FR-17, DC-FR-46: on a declined item, the brand's note comes first, then the evidence and the suggested fix", () => {
    const item = { ...byId("it_6"), declined: true, brandNote: "Please show it on skin.", suggestedFix: "Show the serum being applied to skin, close up." };
    render(<ItemCard item={item} brandName="Glow Theory" expanded onToggle={() => {}} />);
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const note = screen.getByText("“Please show it on skin.”");
    const evidence = screen.getByText("The bottle is in frame, but it isn’t clear the serum is being applied.");
    expect(screen.getByText("Glow Theory asked you to fix this")).toBeVisible();
    expect(follows(note, evidence) && follows(evidence, screen.getByText("Suggested fix"))).toBe(true);
  });
});
