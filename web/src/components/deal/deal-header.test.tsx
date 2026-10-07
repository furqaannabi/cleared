import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { deliverableView } from "@/lib/deliverable/deliverable-view";
import { glowTheoryVideo } from "@/mocks/fixtures/deliverables";
import { DealHeader } from "./deal-header";

const view = deliverableView(glowTheoryVideo, new Date("2026-10-06T12:00:00Z"), { timeZone: "Africa/Lagos" });

describe("DC-FR-32, DC-FR-34 deal header", () => {
  test("breadcrumb, title and details line", () => {
    render(<DealHeader view={view} brandName="Glow Theory" deliverableName="YouTube video" />);
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Deals", "Glow Theory", "YouTube video"]);
    expect(within(crumbs).getByText("YouTube video")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1, name: "Glow Theory · YouTube video" })).toBeVisible();
    expect(screen.getByText("Draft check, run 2")).toBeVisible();
    expect(screen.getByText("6:48 long")).toBeVisible();
    expect(screen.getByText("Post by 24 Oct")).toBeVisible();
  });

  test("the deal steps, with the current one marked", () => {
    render(<DealHeader view={view} brandName="Glow Theory" deliverableName="YouTube video" />);
    const steps = screen.getByRole("list", { name: "Deal progress" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(7);
    expect(within(steps).getByText("Draft check").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Step 3 of 7 · Draft check")).toBeInTheDocument();
  });
});
