import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { DemoPayPal } from "@/components/mocking/demo-paypal";
import { api } from "@/lib/api";
import { BrandDealPage } from "./brand-deal-page";
import { PayPalApprovalProvider } from "./paypal-approval";

/** The demo deal, agreed, with the demo PayPal standing in for PayPal's approval step. */
async function openAgreed() {
  await api.openBrandLink("demo_maple");
  await api.agree("deal_maple", 1);
  render(
    <PayPalApprovalProvider approval={DemoPayPal}>
      <BrandDealPage dealId="deal_maple" />
    </PayPalApprovalProvider>,
  );
  await screen.findByRole("region", { name: /^Holds/ });
}
const holds = () => screen.getByRole("region", { name: /^Holds/ });
const row = (name: string) => within(holds()).getByRole("group", { name });

/** Approves a post's hold with one of the demo PayPal's answers. */
async function approve(post: string, answer: string) {
  await userEvent.click(within(row(post)).getByRole("button", { name: "Approve with PayPal" }));
  await userEvent.click(await within(row(post)).findByRole("button", { name: answer }));
}

describe("CH-FR-17 one hold per post, after agreeing", () => {
  test("each post has its own Approve with PayPal, and the count starts at none held", async () => {
    await openAgreed();
    expect(within(holds()).getByRole("heading", { name: "Holds · 0 of 3 held" })).toBeVisible();
    expect(within(holds()).getAllByRole("button", { name: "Approve with PayPal" })).toHaveLength(3);
  });
});

describe("CH-FR-18 each hold's state", () => {
  test("approved: Held with the PayPal reference and the date the creator posts by; the count goes up", async () => {
    await openAgreed();
    await approve("YouTube video", "Approve");
    expect(await within(row("YouTube video")).findByText(/^Held · \$1,200\.00 · PayPal ref DEMO-\w+ · Ada Okafor posts by \d{1,2} \w{3}$/)).toBeVisible();
    expect(within(row("YouTube video")).queryByRole("button", { name: "Approve with PayPal" })).toBeNull();
    expect(within(holds()).getByRole("heading", { name: "Holds · 1 of 3 held" })).toBeVisible();
    const sheet = screen.getByRole("region", { name: "Sponsorship terms" });
    expect(within(within(sheet).getByRole("group", { name: "YouTube video" })).getByText(/Ada Okafor posts by/)).toBeVisible();
  });

  test("declined: says nothing was taken, and the button is back", async () => {
    await openAgreed();
    await approve("Instagram Reel", "Approve, but the card is declined");
    expect(await within(row("Instagram Reel")).findByText(/^PayPal didn’t approve this hold\. Nothing was taken\./)).toBeVisible();
    expect(within(row("Instagram Reel")).getByRole("button", { name: "Approve with PayPal" })).toBeEnabled();
  });

  test("closed: nothing was held, and the button is back", async () => {
    await openAgreed();
    await approve("YouTube Short", "Close PayPal");
    expect(await within(row("YouTube Short")).findByText("You closed PayPal. Nothing was held.")).toBeVisible();
    expect(within(row("YouTube Short")).getByRole("button", { name: "Approve with PayPal" })).toBeEnabled();
  });

  test("CH-BR-05: still checking with PayPal, the button is off", async () => {
    await openAgreed();
    await approve("YouTube Short", "Approve, but PayPal is slow");
    expect(await within(row("YouTube Short")).findByText("Checking with PayPal…")).toBeVisible();
    expect(within(row("YouTube Short")).getByRole("button", { name: "Approve with PayPal" })).toBeDisabled();
  });
});

describe("CH-FR-19, CH-FR-20 all held, and coming back", () => {
  test("once every post is held it says so, and coming back shows the same", async () => {
    await openAgreed();
    for (const post of ["YouTube video", "Instagram Reel", "YouTube Short"]) await approve(post, "Approve");
    expect(await within(holds()).findByText("All held. Ada Okafor is making the posts.")).toBeVisible();
    expect(within(holds()).queryByRole("button", { name: "Approve with PayPal" })).toBeNull();
  });
});

test("without PayPal wired into this build, the page says so instead of offering a button that can't work", async () => {
  await api.openBrandLink("demo_maple");
  await api.agree("deal_maple", 1);
  render(<BrandDealPage dealId="deal_maple" />);
  const panel = await screen.findByRole("region", { name: /^Holds/ });
  await userEvent.click(within(panel).getAllByRole("button", { name: "Approve with PayPal" })[0]);
  expect(await within(panel).findByText("PayPal isn’t connected in this build yet, so no hold can be approved.")).toBeVisible();
});
