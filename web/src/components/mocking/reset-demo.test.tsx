import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { DealsNav } from "@/components/shell/deals-nav";
import { deals } from "@/test/fixtures/deals";
import { DemoBuildProvider } from "./demo-build";

/* The mock build's reset, which Playwright's runs use until the live suite. */

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
