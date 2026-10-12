import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/test/server";
import { aBrandDeal, apiError, stubBrandDeal } from "@/test/stub-api";
import { BrandDealPage } from "./brand-deal-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// PayPal's script can't load here: a stand-in records what it was given and offers PayPal's three callbacks.
const scriptOptions = vi.hoisted(() => [] as unknown[]);
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ options, children }: { options: unknown; children: ReactNode }) => {
    scriptOptions.push(options);
    return children;
  },
  PayPalButtons: (p: { createOrder: () => Promise<string>; onApprove: () => Promise<void>; onCancel: () => void; onError: () => void }) => (
    <div>
      <button type="button" onClick={async () => { await p.createOrder(); await p.onApprove(); }}>PayPal: approve</button>
      <button type="button" onClick={() => p.onCancel()}>PayPal: close</button>
      <button type="button" onClick={() => p.onError()}>PayPal: error</button>
    </div>
  ),
}));

const ORDER = "5O190127TN364715T";

/** An agreed deal with PayPal's sandbox client id, and the hold routes; the bodies sent are kept. */
function agreedDeal(paypalClientId: string | null = "sandbox-client-id") {
  const deal = aBrandDeal({ step: "agreed", agreedAt: new Date().toISOString(), ...(paypalClientId ? { paypalClientId } : {}) });
  stubBrandDeal(deal);
  const hold = `${apiBaseUrl}/brand/deals/${deal.dealId}/posts/del_maple_video/hold`;
  const sent: { path: string; body: unknown }[] = [];
  const held = { ...deal, posts: [{ ...deal.posts[0], hold: { state: "held" as const, reference: "AUTH-7Y", deadline: "2026-10-25" } }] };
  server.use(
    http.post(hold, () => HttpResponse.json({ orderId: ORDER })),
    http.post(`${hold}/approved`, async ({ request }) => {
      sent.push({ path: "approved", body: await request.json() });
      return HttpResponse.json(held);
    }),
    http.post(`${hold}/closed`, async ({ request }) => {
      sent.push({ path: "closed", body: await request.json() });
      return HttpResponse.json({ ...deal, posts: [{ ...deal.posts[0], hold: { state: "closed" } }] });
    }),
  );
  render(<BrandDealPage dealId={deal.dealId} />);
  return sent;
}

describe("CH-FR-17 (1.3) PayPal's own approval button", () => {
  test("loads PayPal with the deal's sandbox client id, to authorize; approving records the hold", async () => {
    const sent = agreedDeal();
    await userEvent.click(await screen.findByRole("button", { name: "Approve with PayPal" }));
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: approve" }));
    expect(scriptOptions.at(-1)).toMatchObject({ clientId: "sandbox-client-id", intent: "authorize", currency: "USD" });
    expect(sent).toEqual([{ path: "approved", body: { orderId: ORDER } }]);
    expect(await screen.findByText(/All held/)).toBeVisible();
  });

  test("closing PayPal tells the API, and nothing is held", async () => {
    const sent = agreedDeal();
    await userEvent.click(await screen.findByRole("button", { name: "Approve with PayPal" }));
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: close" }));
    expect(sent).toEqual([{ path: "closed", body: { orderId: ORDER } }]);
    expect(await screen.findByText("You closed PayPal. Nothing was held.")).toBeVisible();
  });

  test("PayPal failing says so, and nothing is held", async () => {
    agreedDeal();
    await userEvent.click(await screen.findByRole("button", { name: "Approve with PayPal" }));
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: error" }));
    expect(await screen.findByText("PayPal didn’t load. Nothing was held. Try again.")).toBeVisible();
  });

  test("without a client id from the API, the page says PayPal isn't connected", async () => {
    agreedDeal(null);
    await userEvent.click(await screen.findByRole("button", { name: "Approve with PayPal" }));
    expect(await screen.findByText("PayPal isn’t connected in this build yet, so no hold can be approved.")).toBeVisible();
  });
});

describe("CH-FR-29 (1.4) the session ends during a hold", () => {
  const ended = "Your access to this deal has ended. Open the link Ada Okafor sent you, then try again here.";
  const hold = `${apiBaseUrl}/brand/deals/deal_maple/posts/del_maple_video/hold`;

  test("starting a hold says to open the link again, and Approve with PayPal stays to try again", async () => {
    agreedDeal();
    server.use(http.post(hold, () => apiError({ code: "signed_out" }, 401)));
    await userEvent.click(await screen.findByRole("button", { name: "Approve with PayPal" }));
    expect(await screen.findByText(ended)).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve with PayPal" })).toBeEnabled();
  });

  test("finishing a hold says to open the link again, never that PayPal is still confirming", async () => {
    agreedDeal();
    server.use(http.post(`${hold}/approved`, () => apiError({ code: "signed_out" }, 401)));
    await userEvent.click(await screen.findByRole("button", { name: "Approve with PayPal" }));
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: approve" }));
    expect(await screen.findByText(ended)).toBeVisible();
    expect(screen.queryByText(/couldn’t confirm this with PayPal/)).toBeNull();
    expect(screen.getByRole("button", { name: "Approve with PayPal" })).toBeEnabled();
  });
});
