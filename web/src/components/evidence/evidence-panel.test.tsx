import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { SeekProvider } from "@/components/player/seek";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { EvidencePanel } from "./evidence-panel";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));
const byId = (id: string) => view.items.find((i) => i.id === id)!;

describe("DC-FR-12 evidence panel", () => {
  test("shows the selected item's result, evidence, brief line and how it was checked", () => {
    render(<EvidencePanel item={byId("it_5")} brandName="Glow Theory" />);
    const panel = screen.getByRole("region", { name: "Evidence for Code GLOW20 shown on screen" });
    expect(within(panel).getByRole("heading", { level: 2, name: "Code GLOW20 shown on screen" })).toBeVisible();
    expect(within(panel).getByText("Shown as text · 3:15")).toBeVisible();
    expect(within(panel).getByText("Fix needed")).toBeVisible();
    expect(within(panel).getByText("On-screen text")).toBeVisible();
    expect(within(panel).getByText("Reads “GLOW2O”, with a letter O where the zero should be.")).toBeVisible();
    expect(within(panel).getByText("Line 5: “Say and show the code GLOW20.”")).toBeVisible();
    expect(within(panel).getByText("Exact match")).toBeVisible();
  });

  test("DC-FR-12 (1.13): an item the creator added says so under From the brief", () => {
    const { briefLine, ...added } = byId("it_5");
    void briefLine;
    render(<EvidencePanel item={added} brandName="Glow Theory" />);
    expect(screen.getByText("Added by you")).toBeVisible();
  });

  test("with nothing selected, says how to see an item's evidence", () => {
    render(<EvidencePanel item={null} brandName="Glow Theory" />);
    expect(screen.getByRole("region", { name: "Evidence" })).toHaveTextContent(
      "Choose an item in the checklist to see its evidence and the brief line it came from.",
    );
  });

  test("DC-FR-23: the item's timestamp plays the draft from that moment", async () => {
    const seek = vi.fn();
    render(
      <SeekProvider seek={seek}>
        <EvidencePanel item={byId("it_5")} brandName="Glow Theory" />
      </SeekProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Play from 3:15" }));
    expect(seek).toHaveBeenCalledWith("it_5");
  });

  test("DC-FR-46: a suggested fix sits after the evidence and before the brief line", () => {
    const hint = "Change the on-screen code to GLOW20, with a zero, not the letter O.";
    render(<EvidencePanel item={{ ...byId("it_5"), suggestedFix: hint }} brandName="Glow Theory" />);
    const panel = screen.getByRole("region", { name: "Evidence for Code GLOW20 shown on screen" });
    const label = within(panel).getByText("Suggested fix");
    const text = within(panel).getByText(hint);
    const evidence = within(panel).getByText("Reads “GLOW2O”, with a letter O where the zero should be.");
    const brief = within(panel).getByText("Line 5: “Say and show the code GLOW20.”");
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(text).toBeVisible();
    expect(follows(evidence, label) && follows(text, brief)).toBe(true);
  });

  test("DC-FR-46: with no suggested fix, nothing stands in for it", () => {
    render(<EvidencePanel item={{ ...byId("it_5"), suggestedFix: null }} brandName="Glow Theory" />);
    expect(screen.queryByText("Suggested fix")).toBeNull();
  });
});
