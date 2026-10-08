import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DemoBuildProvider } from "@/components/mocking/demo-build";
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

describe("DC-FR-31 initials", () => {
  test("skip words that aren't letters, such as an ampersand", () => {
    render(<DealsNav deals={[{ id: "deal_pine", brandName: "Pine & Co", status: "Invite", deliverables: [] }]} currentDealId={null} />);
    expect(screen.getByRole("link")).toHaveTextContent(/^PCPine & Co/);
  });
});

describe("Mock builds: reset the demo data", () => {
  test("in a mock build, a confirmed Reset demo data puts the seed back", async () => {
    const reset = vi.fn();
    render(
      <DemoBuildProvider reset={reset}>
        <DealsNav deals={deals} currentDealId={null} />
      </DemoBuildProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reset demo data" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, reset" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  test("outside a mock build there is no reset", () => {
    render(<DealsNav deals={deals} currentDealId={null} />);
    expect(screen.queryByRole("button", { name: "Reset demo data" })).toBeNull();
  });
});
