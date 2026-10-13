import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/test/server";
import { aBrandDeal, apiError, stubBrandDeal } from "@/test/stub-api";
import { BrandDealPage } from "./brand-deal-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// PayPal's script can't load here: a stand-in records what it was given, reports the script's state, and offers PayPal's three callbacks.
const paypal = vi.hoisted(() => ({ options: [] as unknown[], script: "resolved" as "pending" | "resolved" | "rejected", resets: 0 }));
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ options, children }: { options: unknown; children: ReactNode }) => {
    paypal.options.push(options);
    return children;
  },
  usePayPalScriptReducer: () => [
    { isPending: paypal.script === "pending", isRejected: paypal.script === "rejected", isResolved: paypal.script === "resolved" },
    () => {
      paypal.resets += 1;
    },
  ],
  PayPalButtons: (p: { createOrder: () => Promise<string>; onApprove: () => Promise<void>; onCancel: () => void; onError: () => void }) => (
    <div>
      <button
        type="button"
        onClick={async () => {
          try {
            await p.createOrder();
          } catch {
            return p.onError();
          }
          await p.onApprove();
        }}
      >
        PayPal: approve
      </button>
      <button type="button" onClick={async () => { await p.createOrder(); p.onCancel(); }}>PayPal: close</button>
      <button type="button" onClick={() => p.onError()}>PayPal: error</button>
    </div>
  ),
}));
beforeEach(() => {
  paypal.script = "resolved";
  paypal.resets = 0;
});

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
  test("1.9: PayPal's buttons are the only buttons; one click approves, with PayPal account or card only", async () => {
    const sent = agreedDeal();
    expect(await screen.findByText("Approve the hold with PayPal or a card")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve with PayPal" })).toBeNull();
    expect(paypal.options.at(-1)).toMatchObject({ clientId: "sandbox-client-id", intent: "authorize", currency: "USD", disableFunding: ["paylater", "credit", "venmo"] });
    await userEvent.click(screen.getByRole("button", { name: "PayPal: approve" }));
    expect(sent).toEqual([{ path: "approved", body: { orderId: ORDER } }]);
    expect(await screen.findByText(/All held/)).toBeVisible();
  });

  test("closing PayPal tells the API, and nothing is held", async () => {
    const sent = agreedDeal();
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: close" }));
    expect(sent).toEqual([{ path: "closed", body: { orderId: ORDER } }]);
    expect(await screen.findByText("You closed PayPal. Nothing was held.")).toBeVisible();
  });

  test("1.9: until PayPal's script is ready, Loading PayPal… holds the buttons' place", async () => {
    paypal.script = "pending";
    agreedDeal();
    expect(await screen.findByText("Loading PayPal…")).toBeVisible();
    expect(screen.queryByRole("button", { name: "PayPal: approve" })).toBeNull();
  });

  test("1.9: PayPal's script failing says so, and Try again loads it again", async () => {
    paypal.script = "rejected";
    agreedDeal();
    expect(await screen.findByText(/^PayPal didn’t load\. Nothing was held\./)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(paypal.resets).toBe(1);
  });

  test("PayPal reporting an error says it didn't load, with Try again", async () => {
    agreedDeal();
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: error" }));
    expect(await screen.findByText(/^PayPal didn’t load\. Nothing was held\./)).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("1.9: the API refusing the order says nothing was held, never that PayPal didn't load, and the buttons stay", async () => {
    agreedDeal();
    server.use(http.post(`${apiBaseUrl}/brand/deals/deal_maple/posts/del_maple_video/hold`, () => apiError({ code: "unavailable" }, 503)));
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: approve" }));
    expect(await screen.findByText("That didn’t go through. Nothing was held. Try again.")).toBeVisible();
    expect(screen.queryByText(/PayPal didn’t load/)).toBeNull();
    expect(screen.getByRole("button", { name: "PayPal: approve" })).toBeVisible();
  });

  test("without a client id from the API, the page says PayPal isn't connected", async () => {
    agreedDeal(null);
    expect(await screen.findByText("PayPal isn’t connected in this build yet, so no hold can be approved.")).toBeVisible();
  });
});

describe("CH-FR-29 (1.4) the session ends during a hold", () => {
  const ended = "Your access to this deal has ended. Open the link Ada Okafor sent you, then try again here.";
  const hold = `${apiBaseUrl}/brand/deals/deal_maple/posts/del_maple_video/hold`;

  test("starting a hold says to open the link again, and PayPal's buttons stay to try again", async () => {
    agreedDeal();
    server.use(http.post(hold, () => apiError({ code: "signed_out" }, 401)));
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: approve" }));
    expect(await screen.findByText(ended)).toBeVisible();
    expect(screen.getByRole("button", { name: "PayPal: approve" })).toBeVisible();
  });

  test("finishing a hold says to open the link again, never that PayPal is still confirming", async () => {
    agreedDeal();
    server.use(http.post(`${hold}/approved`, () => apiError({ code: "signed_out" }, 401)));
    await userEvent.click(await screen.findByRole("button", { name: "PayPal: approve" }));
    expect(await screen.findByText(ended)).toBeVisible();
    expect(screen.queryByText(/couldn’t confirm this with PayPal/)).toBeNull();
    expect(screen.getByRole("button", { name: "PayPal: approve" })).toBeVisible();
  });
});
