import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import type { Deliverable } from "@/lib/deliverable/types";
import { MoneyCard } from "./money-card";

const renderCard = (overrides: Partial<Deliverable> = {}) =>
  render(<MoneyCard deliverable={{ ...glowTheoryVideo, ...overrides }} timeZone="UTC" />);

describe("DC-FR-27 money card", () => {
  test("shows the held amount, its PayPal reference and date, and where it pays out", () => {
    renderCard();
    const card = screen.getByRole("region", { name: "Payment for this deliverable" });
    expect(within(card).getByText("Held in PayPal for this video")).toBeVisible();
    expect(within(card).getByText("$1,200.00")).toBeVisible();
    expect(within(card).getByText("Ref 7HK21934LM · held 3 Oct")).toBeVisible();
    expect(within(card).getByText("Pays out to")).toBeVisible();
    expect(within(card).getByText("ada.okafor@example.com")).toBeVisible();
  });

  test("shows the four money stages with the current one marked", () => {
    renderCard({ hold: { ...glowTheoryVideo.hold, stage: "confirmed" } });
    const track = screen.getByRole("list", { name: "Money stage" });
    expect(within(track).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Held",
      "Confirmed",
      "Captured",
      "Paid",
    ]);
    expect(within(track).getByText("Confirmed")).toHaveAttribute("aria-current", "step");
    expect(within(track).getByText("Held")).not.toHaveAttribute("aria-current");
  });

  test("DC-FR-29 released: where the money went, when and why, as a single stage", () => {
    renderCard({ state: "released", releaseReason: "deadline", releasedAt: "2026-10-25T09:00:00Z" });
    const card = screen.getByRole("region", { name: "Payment for this deliverable" });
    expect(within(card).getByText("Released to Glow Theory")).toBeVisible();
    expect(within(card).getByText("$1,200.00")).toBeVisible();
    expect(within(card).getByText("Released 25 Oct · deadline passed")).toBeVisible();
    const track = within(card).getByRole("list", { name: "Money stage" });
    expect(within(track).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Released"]);
    expect(within(card).getByText("Went back to")).toBeVisible();
    expect(within(card).getByText("Glow Theory’s PayPal")).toBeVisible();
    expect(within(card).queryByText(/Pays out to/)).toBeNull();
  });

  test("DC-FR-29: shows a release reference only when the API gives one", () => {
    renderCard({ state: "released", releaseReason: "cancelled", releasedAt: "2026-10-12T09:00:00Z" });
    expect(screen.getByText("Released 12 Oct · deal cancelled")).toBeVisible();
    expect(screen.queryByText(/Ref /)).toBeNull();
  });
});
