import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { aMapleDeal, stubMapleDeal } from "@/test/brand-deal";
import { server } from "@/test/server";
import type { BrandDeal } from "@/test/stub-api";
import { BrandDealPage } from "./brand-deal-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

// PayPal's script can't load here: a stand-in offers PayPal's approve and close.
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ children }: { children: ReactNode }) => children,
  usePayPalScriptReducer: () => [{ isPending: false, isRejected: false, isResolved: true }, () => {}],
  PayPalButtons: (p: { createOrder: () => Promise<string>; onApprove: () => Promise<void>; onCancel: () => void }) => (
    <div>
      <button type="button" onClick={async () => { await p.createOrder(); await p.onApprove(); }}>PayPal: approve</button>
      <button type="button" onClick={async () => { await p.createOrder(); p.onCancel(); }}>PayPal: close</button>
    </div>
  ),
}));

type Hold = BrandDeal["posts"][number]["hold"];
const POST_IDS: Record<string, string> = { "YouTube video": "del_maple_video", "Instagram Reel": "del_maple_reel", "YouTube Short": "del_maple_short" };

/**
 * Maple & Moss's deal, agreed, with PayPal's sandbox client id. Each post's
 * approval answers with the hold in `answers` (held unless set); closing PayPal
 * answers that nothing was held.
 */
async function openAgreed(answers: Record<string, Hold> = {}) {
  const deal = stubMapleDeal({ step: "agreed", agreedAt: new Date().toISOString(), paypalClientId: "sandbox-client-id" });
  const withHold = (d: BrandDeal, id: string, hold: Hold): BrandDeal => ({ ...d, posts: d.posts.map((p) => (p.deliverableId === id ? { ...p, hold } : p)) });
  server.use(http.post(`${apiBaseUrl}/brand/deals/deal_maple/posts/:deliverableId/hold`, () => HttpResponse.json({ orderId: "5O190127TN364715T" })));
  deal.on("post", "/posts/:deliverableId/hold/approved", (d, { params }) =>
    withHold(d, params.deliverableId, answers[params.deliverableId] ?? { state: "held", reference: `AUTH-${params.deliverableId}`, deadline: "2026-10-26" }),
  );
  deal.on("post", "/posts/:deliverableId/hold/closed", (d, { params }) => withHold(d, params.deliverableId, { state: "closed" }));
  render(<BrandDealPage dealId="deal_maple" />);
  await screen.findByRole("region", { name: /^Holds/ });
}
const holds = () => screen.getByRole("region", { name: /^Holds/ });
const row = (name: string) => within(holds()).getByRole("group", { name });

/** Opens PayPal for a post and approves, or closes it. */
async function approve(post: string, button: "PayPal: approve" | "PayPal: close" = "PayPal: approve") {
  await userEvent.click(within(row(post)).getByRole("button", { name: button }));
}

describe("CH-FR-17 one hold per post, after agreeing", () => {
  test("each post has its own PayPal buttons, and the count starts at none held", async () => {
    await openAgreed();
    expect(within(holds()).getByRole("heading", { name: "Holds · 0 of 3 held" })).toBeVisible();
    expect(within(holds()).getAllByRole("button", { name: "PayPal: approve" })).toHaveLength(3);
    expect(within(holds()).getAllByText("Approve the hold with PayPal or a card")).toHaveLength(3);
  });
});

describe("CH-FR-18 each hold's state", () => {
  test("approved: Held with the PayPal reference and the date the creator posts by; the count goes up", async () => {
    await openAgreed({ del_maple_video: { state: "held", reference: "7HK21934LM", deadline: "2026-10-26" } });
    await approve("YouTube video");
    expect(await within(row("YouTube video")).findByText("Held · $1,200.00 · PayPal ref 7HK21934LM · Ada Okafor posts by 26 Oct")).toBeVisible();
    expect(within(row("YouTube video")).queryByRole("button", { name: "PayPal: approve" })).toBeNull();
    expect(within(holds()).getByRole("heading", { name: "Holds · 1 of 3 held" })).toBeVisible();
    const sheet = screen.getByRole("region", { name: "Sponsorship terms" });
    expect(within(within(sheet).getByRole("group", { name: "YouTube video" })).getByText(/Ada Okafor posts by/)).toBeVisible();
  });

  test("declined: says nothing was taken, and PayPal's buttons are back", async () => {
    await openAgreed({ del_maple_reel: { state: "declined" } });
    await approve("Instagram Reel");
    expect(await within(row("Instagram Reel")).findByText(/^PayPal didn’t approve this hold\. Nothing was taken\./)).toBeVisible();
    expect(within(row("Instagram Reel")).getByRole("button", { name: "PayPal: approve" })).toBeVisible();
  });

  test("closed: nothing was held, and PayPal's buttons are back", async () => {
    await openAgreed();
    await approve("YouTube Short", "PayPal: close");
    expect(await within(row("YouTube Short")).findByText("You closed PayPal. Nothing was held.")).toBeVisible();
    expect(within(row("YouTube Short")).getByRole("button", { name: "PayPal: approve" })).toBeVisible();
  });

  test("CH-BR-05: still checking with PayPal, there are no buttons (1.9)", async () => {
    await openAgreed({ del_maple_short: { state: "pending" } });
    await approve("YouTube Short");
    expect(await within(row("YouTube Short")).findByText("Checking with PayPal…")).toBeVisible();
    expect(within(row("YouTube Short")).queryByRole("button", { name: "PayPal: approve" })).toBeNull();
  });
});

describe("CH-FR-19, CH-FR-20 all held, and coming back", () => {
  test("once every post is held it says so, and coming back shows the same", async () => {
    await openAgreed();
    for (const post of Object.keys(POST_IDS)) await approve(post);
    expect(await within(holds()).findByText("All held. Ada Okafor is making the posts.")).toBeVisible();
    expect(within(holds()).queryByRole("button", { name: "PayPal: approve" })).toBeNull();
  });
});

describe("CH-FR-18 (1.7) a post never held", () => {
  test("says it is closed and why, with no PayPal buttons", async () => {
    stubMapleDeal({
      step: "agreed",
      agreedAt: new Date().toISOString(),
      paypalClientId: "sandbox-client-id",
      posts: aMapleDeal().posts.map((p, i) => (i === 1 ? { ...p, hold: { state: "not_held", because: "never_held" } } : p)),
    });
    render(<BrandDealPage dealId="deal_maple" />);
    const reel = within(await screen.findByRole("region", { name: /^Holds/ })).getByRole("group", { name: "Instagram Reel" });
    expect(within(reel).getByText("Not held. No hold was approved within 7 days of agreeing, so this post is closed. Nothing was taken.")).toBeVisible();
    expect(within(reel).queryByRole("button", { name: "PayPal: approve" })).toBeNull();
  });
});
