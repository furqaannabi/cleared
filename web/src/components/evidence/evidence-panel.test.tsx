import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { EvidencePanel } from "./evidence-panel";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"));
const byId = (id: string) => view.items.find((i) => i.id === id)!;

describe("DC-FR-12 evidence panel", () => {
  test("shows the selected item's result, evidence, brief line and how it was checked", () => {
    render(<EvidencePanel item={byId("it_5")} brandName="Glow Theory" />);
    const panel = screen.getByRole("region", { name: "Evidence for Code GLOW20 shown on screen" });
    expect(within(panel).getByRole("heading", { name: "Code GLOW20 shown on screen" })).toBeVisible();
    expect(within(panel).getByText("Shown as text · 3:15")).toBeVisible();
    expect(within(panel).getByText("Fix needed")).toBeVisible();
    expect(within(panel).getByText("On-screen text")).toBeVisible();
    expect(within(panel).getByText("Reads “GLOW2O”, with a letter O where the zero should be.")).toBeVisible();
    expect(within(panel).getByText("Line 5: “Say and show the code GLOW20.”")).toBeVisible();
    expect(within(panel).getByText("Exact match")).toBeVisible();
  });

  test("with nothing selected, says how to see an item's evidence", () => {
    render(<EvidencePanel item={null} brandName="Glow Theory" />);
    expect(screen.getByRole("region", { name: "Evidence" })).toHaveTextContent(
      "Choose an item in the checklist to see its evidence and the brief line it came from.",
    );
  });
});
