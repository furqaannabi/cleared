import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { deals } from "@/mocks/fixtures/deals";
import { DealsNav } from "./deals-nav";

describe("DC-FR-31 deals list", () => {
  test("each deal is a link with its brand, initials and status line; the current one is marked", () => {
    render(<DealsNav deals={deals} currentDealId="deal_glow" />);
    const links = within(screen.getByRole("navigation", { name: "Deals" })).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/deals/deal_glow", "/deals/deal_nb", "/deals/deal_kora"]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).not.toHaveAttribute("aria-current");
    expect(links[1]).toHaveTextContent("NCNorthbound CoffeeBrand review");
  });
});
