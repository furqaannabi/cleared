import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { aBrandDeal, stubBrandDeal } from "@/test/stub-api";
import { BrandDealPage } from "./brand-deal-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

/* CH 1.3: the brand's page against the contract's answers, one stub per test. */

/** Agreeing answers the deal, agreed; the body sent is kept for the test. */
function agreeing() {
  const deal = aBrandDeal();
  stubBrandDeal(deal);
  const sent: unknown[] = [];
  server.use(
    http.post(`${apiBaseUrl}/brand/deals/${deal.dealId}/agree`, async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json({ ...deal, step: "agreed", agreedAt: new Date().toISOString() });
    }),
  );
  render(<BrandDealPage dealId={deal.dealId} />);
  return sent;
}

describe("CH-FR-28 (1.3) the brand's own email when agreeing", () => {
  test("is optional, says what it's for, and goes with the agreement", async () => {
    const sent = agreeing();
    const email = await screen.findByRole("textbox", { name: "Your email (optional)" });
    expect(email).toHaveAccessibleDescription("We’ll only email you if Ada Okafor’s post needs your answer after it’s live. Ada Okafor won’t see it.");
    await userEvent.type(email, "lena@maplemoss.com");
    await userEvent.click(screen.getByRole("button", { name: "Agree to these terms" }));
    expect(await screen.findByText(/^Agreed · version 1/)).toBeVisible();
    expect(sent).toEqual([{ version: 1, email: "lena@maplemoss.com" }]);
  });

  test("empty, agreeing works the same; a malformed one is said before agreeing", async () => {
    const sent = agreeing();
    const email = await screen.findByRole("textbox", { name: "Your email (optional)" });
    await userEvent.type(email, "lena@");
    await userEvent.click(screen.getByRole("button", { name: "Agree to these terms" }));
    expect(await screen.findByText("Enter an email, like name@example.com")).toBeVisible();
    expect(sent).toEqual([]);
    await userEvent.clear(email);
    await userEvent.click(screen.getByRole("button", { name: "Agree to these terms" }));
    expect(await screen.findByText(/^Agreed · version 1/)).toBeVisible();
    expect(sent).toEqual([{ version: 1 }]);
  });
});
