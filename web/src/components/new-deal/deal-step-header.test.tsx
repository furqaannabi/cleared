import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DealStepHeader } from "./deal-step-header";

describe("BC-FR-22 the crumb and steps go back", () => {
  test("the crumb links to the deals and the deal; reached steps link, the current one and later ones don't", () => {
    render(
      <DealStepHeader
        brand="Glow Theory"
        dealId="deal_1"
        title="Invite"
        stage="invite"
        links={{ brief: "/deals/deal_1/checklist#brief", checklist: "/deals/deal_1/checklist", invite: "/deals/deal_1/invite" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Deals" })).toHaveAttribute("href", "/deals");
    expect(screen.getByRole("link", { name: "Glow Theory" })).toHaveAttribute("href", "/deals/deal_1");
    const steps = screen.getByRole("list", { name: "New deal steps" });
    expect(within(steps).getByRole("link", { name: /Brief/ })).toHaveAttribute("href", "/deals/deal_1/checklist#brief");
    expect(within(steps).getByRole("link", { name: /Checklist/ })).toHaveAttribute("href", "/deals/deal_1/checklist");
    expect(within(steps).queryByRole("link", { name: /Posts/ })).toBeNull();
    expect(within(steps).queryByRole("link", { name: /Invite/ })).toBeNull();
    expect(within(steps).getByText("Invite").closest("li")).toHaveAttribute("aria-current", "step");
  });

  test("on the new deal page the crumb is Deals › New deal", () => {
    render(<DealStepHeader title="New deal" stage="posts" />);
    expect(screen.getByRole("link", { name: "Deals" })).toHaveAttribute("href", "/deals");
    expect(screen.getByText("New deal", { selector: "p span" })).toBeVisible();
  });
});
