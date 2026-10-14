import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { aBrandDeal, stubBrandDeal } from "@/test/stub-api";
import { BrandDealPage } from "./brand-deal-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

const screenWidth = (px: number) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(min-width: 768px)" ? px >= 768 : query === "(min-width: 1024px)" ? px >= 1024 : false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));

const POINTS = [
  "PayPal reserves the amount for each post. Nothing is taken from your account yet.",
  "It’s taken only after Ada Okafor’s post is live and passes its check, and never more than you approved.",
  "It comes back to you if Ada Okafor misses the deadline, if either of you cancels before Ada Okafor is told to publish, or on day 28 at the latest.",
  "You pay the amounts above and nothing more. Sponing’s 5% fee comes out of Ada Okafor’s payout.",
  "This is PayPal’s sandbox. No real money moves.",
];

describe("CH-FR-31 (1.6) how your money is held", () => {
  test("from md:, open under How payment works with the five points", async () => {
    screenWidth(1280);
    stubBrandDeal(aBrandDeal());
    render(<BrandDealPage dealId="deal_maple" />);
    const panel = await screen.findByRole("region", { name: "How your money is held" });
    for (const p of POINTS) expect(panel).toHaveTextContent(p);
    expect(screen.queryByRole("button", { name: /How your money is held/ })).toBeNull();
  });

  test("on phones, folded behind Read; opening shows the points", async () => {
    screenWidth(375);
    stubBrandDeal(aBrandDeal());
    render(<BrandDealPage dealId="deal_maple" />);
    const toggle = await screen.findByRole("button", { name: "How your money is held · Read" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(POINTS[0])).toBeNull();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(POINTS[0])).toBeVisible();
  });
});

describe("CH-FR-32 (1.6) before approving", () => {
  test("after agreeing, a link above the holds opens the panel and moves focus to it", async () => {
    screenWidth(375);
    stubBrandDeal(aBrandDeal({ step: "agreed", agreedAt: "2026-10-10T10:00:00.000Z" }));
    render(<BrandDealPage dealId="deal_maple" />);
    const holds = await screen.findByRole("region", { name: /^Holds/ });
    const link = within(holds).getByRole("button", { name: "How your money is held" });
    // 1.9: the link sits above each post's PayPal buttons.
    const approve = within(holds).getAllByText("Approve the hold with PayPal or a card")[0];
    expect(link.compareDocumentPosition(approve) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(link);
    expect(screen.getByText(POINTS[0])).toBeVisible();
    expect(screen.getByRole("heading", { name: /^How your money is held/ })).toHaveFocus();
  });

  test("before agreeing there is no link above the holds", async () => {
    stubBrandDeal(aBrandDeal());
    render(<BrandDealPage dealId="deal_maple" />);
    await screen.findByRole("button", { name: /How your money is held/ });
    expect(screen.queryByRole("button", { name: "How your money is held" })).toBeNull();
  });
});
