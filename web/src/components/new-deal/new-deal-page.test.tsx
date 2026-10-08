import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { NewDealPage } from "./new-deal-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("BC-FR-21 the new deal page", () => {
  test("has the crumb and the four steps with Posts current", () => {
    render(<NewDealPage />);
    expect(screen.getByText("Deals › New deal")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "New deal" })).toBeVisible();
    const steps = screen.getByRole("list", { name: "New deal steps" });
    expect(within(steps).getByText("Posts").closest("li")).toHaveAttribute("aria-current", "step");
  });

  test("the preview of the terms sheet fills in as the creator types", async () => {
    render(<NewDealPage />);
    const preview = screen.getByRole("region", { name: "Taking shape: the terms the brand will see" });
    expect(within(preview).getAllByRole("listitem").map((l) => l.querySelector("b")?.textContent)).toEqual(["YouTube video"]);
    await userEvent.type(screen.getByLabelText("Brand"), "Glow Theory");
    await userEvent.click(screen.getByRole("button", { name: "Add another post" }));
    await userEvent.selectOptions(screen.getByLabelText("Post 2"), "instagram_reel");
    const named = screen.getByRole("region", { name: "Taking shape: the terms Glow Theory will see" });
    expect(within(named).getAllByRole("listitem").map((l) => l.querySelector("b")?.textContent)).toEqual(["YouTube video", "Instagram Reel"]);
    expect(within(named).getByText("Glow Theory")).toBeVisible();
    expect(await within(named).findByText("Ada Okafor")).toBeVisible();
    expect(within(named).getByText("Amounts and deadlines come at the Invite step.")).toBeVisible();
  });

  test("explains the four steps of setting up a deal", () => {
    render(<NewDealPage />);
    const how = screen.getByRole("list", { name: "How setting up a deal works" });
    expect(within(how).getAllByRole("listitem").map((l) => l.querySelector("b")?.textContent)).toEqual(["Posts", "Brief", "Checklist", "Invite"]);
    expect(screen.getByText("Nothing is held or paid until the brand approves.")).toBeVisible();
  });
});
