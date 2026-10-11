import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { aBrandDeal, apiError, stubBrandDeal } from "@/test/stub-api";
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

describe("CH-FR-03 (1.4) no session", () => {
  test("a 401 asks for the link again, never 'check your connection'", async () => {
    server.use(http.get(`${apiBaseUrl}/brand/deals/deal_maple`, () => apiError({ code: "signed_out" }, 401)));
    render(<BrandDealPage dealId="deal_maple" />);
    expect(await screen.findByRole("heading", { name: "Open the link you were sent again" })).toBeVisible();
    expect(screen.queryByText(/connection/i)).toBeNull();
  });
});

describe("CH-FR-29 (1.4) the session ends during an action", () => {
  const ended = "Your access to this deal has ended. Open the link Ada Okafor sent you, then try again here.";

  test("agreeing says to open the link again, and the email typed stays", async () => {
    const deal = aBrandDeal();
    stubBrandDeal(deal);
    server.use(http.post(`${apiBaseUrl}/brand/deals/${deal.dealId}/agree`, () => apiError({ code: "signed_out" }, 401)));
    render(<BrandDealPage dealId={deal.dealId} />);
    const email = await screen.findByRole("textbox", { name: "Your email (optional)" });
    await userEvent.type(email, "lena@maplemoss.com");
    await userEvent.click(screen.getByRole("button", { name: "Agree to these terms" }));
    expect(await screen.findByText(ended)).toBeVisible();
    expect(email).toHaveValue("lena@maplemoss.com");
    expect(screen.queryByText(/couldn’t reach/i)).toBeNull();
  });

  test("sending notes says to open the link again, and the unsent notes stay", async () => {
    const deal = aBrandDeal();
    stubBrandDeal(deal);
    server.use(http.post(`${apiBaseUrl}/brand/deals/${deal.dealId}/notes`, () => apiError({ code: "signed_out" }, 401)));
    render(<BrandDealPage dealId={deal.dealId} />);
    const item = "Say “Maple & Moss” in the first minute (YouTube video)";
    await userEvent.click(await screen.findByRole("button", { name: `Ask for a change to ${item}` }));
    await userEvent.type(screen.getByRole("textbox", { name: `Your note about ${item}` }), "In the first 30 seconds.");
    await userEvent.click(screen.getByRole("button", { name: "Save note" }));
    await userEvent.click(screen.getByRole("button", { name: "Send 1 change to Ada Okafor" }));
    expect(await screen.findByText(ended)).toBeVisible();
    expect(screen.getByRole("button", { name: "Send 1 change to Ada Okafor" })).toBeVisible();
    expect(screen.queryByText("Your notes didn’t send. Try again.")).toBeNull();
  });
});

