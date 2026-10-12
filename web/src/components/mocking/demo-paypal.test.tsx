import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { BrandDealPage } from "@/components/brand-deal/brand-deal-page";
import { PayPalApprovalProvider } from "@/components/brand-deal/paypal-approval";
import { api } from "@/lib/api";
import { runOnMockBackend } from "@/mocks/mock-backend";
import { DemoPayPal } from "./demo-paypal";

/* The demo PayPal stands in for PayPal's approval in the mock build Playwright runs on, until the live suite. */
runOnMockBackend();

describe("Mocks: the demo PayPal", () => {
  test("approving holds the post on the mock backend, with a demo reference", async () => {
    await api.openBrandLink("demo_maple");
    await api.agree("deal_maple", 1);
    render(
      <PayPalApprovalProvider approval={DemoPayPal}>
        <BrandDealPage dealId="deal_maple" />
      </PayPalApprovalProvider>,
    );
    const row = within(await screen.findByRole("region", { name: /^Holds/ })).getByRole("group", { name: "YouTube video" });
    await userEvent.click(within(row).getByRole("button", { name: "Approve with PayPal" }));
    await userEvent.click(await within(row).findByRole("button", { name: "Approve" }));
    expect(await within(row).findByText(/^Held · \$1,200\.00 · PayPal ref DEMO-\w+ · Ada Okafor posts by \d{1,2} \w{3}$/)).toBeVisible();
  });
});
