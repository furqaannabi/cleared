import { render, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import type { PaymentRow } from "@/lib/home/payment-row";
import { aPayment } from "@/lib/home/test-rows";
import { aProfile, stubDeals, stubPayments, stubSession, type DealSummary } from "@/test/stub-api";
import { HomePage } from "./home-page";

afterEach(() => vi.unstubAllGlobals());

const aDeal = (d: Partial<DealSummary> = {}): DealSummary => ({
  id: "deal_kora",
  brandName: "Kora Audio",
  status: "Paid",
  step: "agreed",
  deliverables: [{ id: "del_kora_video", platform: "youtube_video", state: "paid" }],
  ...d,
});

/** Home in the creator frame, signed in, with these deals and payments. */
async function openHome({ deals = [aDeal()], payments = [aPayment()], flag = true }: { deals?: DealSummary[]; payments?: PaymentRow[] | null; flag?: boolean } = {}) {
  stubSession(aProfile());
  stubDeals(deals);
  if (payments) stubPayments(payments);
  else server.use(http.get(`${apiBaseUrl}/me/payments`, () => HttpResponse.json({}, { status: 500 })));
  render(
    <AppShell currentDealId={null}>
      <HomePage payments={flag} />
    </AppShell>,
  );
  await screen.findByRole("heading", { level: 1, name: "Home" });
}

describe("HM-FR-03 no deals yet", () => {
  test("says so with Start a deal, and nothing about money", async () => {
    await openHome({ deals: [], payments: [] });
    const main = screen.getByRole("main");
    expect(await within(main).findByText("You have no deals yet.")).toBeVisible();
    expect(within(main).getByRole("link", { name: "Start a deal" })).toHaveAttribute("href", "/deals/new");
    expect(screen.queryByRole("region", { name: "Your money" })).toBeNull();
  });
});

describe("HM-FR-05, HM-FR-06 the money overview", () => {
  test("three totals in what the creator receives, with what's stuck linking to its post", async () => {
    await openHome({
      payments: [
        aPayment({ deliverableId: "h", stage: "held", payout: undefined, paidAt: undefined, receivedMinor: 266000 }),
        aPayment({ dealId: "deal_j", deliverableId: "del_j", brandName: "Juniper & Salt", platform: "instagram_reel", stage: "captured", payout: { state: "failed" }, paidAt: undefined, receivedMinor: 114000 }),
        aPayment({ receivedMinor: 641250 }),
      ],
    });
    const money = await screen.findByRole("region", { name: "Your money" });
    expect(within(money).getByText("Held for you").closest("div")).toHaveTextContent("Held for you$2,660.001 post");
    expect(within(money).getByText("On its way").closest("div")).toHaveTextContent("On its way$1,140.001 post");
    expect(within(money).getByText("Paid").closest("div")).toHaveTextContent("Paid$6,412.501 post");
    expect(within(money).getByText("What you receive, after Cleared’s 5% fee.")).toBeVisible();
    expect(within(money).getByRole("link", { name: "Juniper & Salt · Reel: the payout didn’t go through." })).toHaveAttribute("href", "/deals/deal_j/deliverables/del_j");
  });

  test("past three stuck payouts, the rest are counted", async () => {
    const stuck = (id: string) => aPayment({ deliverableId: id, stage: "captured", payout: { state: "unclaimed" }, paidAt: undefined });
    await openHome({ payments: ["a", "b", "c", "d"].map(stuck) });
    const money = await screen.findByRole("region", { name: "Your money" });
    expect(within(money).getAllByRole("link")).toHaveLength(3);
    expect(within(money).getByText("and 1 more")).toBeVisible();
  });
});

describe("HM-FR-20 the flag", () => {
  test("with it off, home is the deals alone and asks for no payments", async () => {
    await openHome({ flag: false, deals: [aDeal()] });
    expect(await screen.findByRole("region", { name: "Deals" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Your money" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Payment history" })).toBeNull();
    expect(screen.queryByText(/coming/i)).toBeNull();
  });
});

describe("HM-FR-04 payments failing", () => {
  test("the money sections give way to one line with Try again; the deals still show", async () => {
    await openHome({ payments: null });
    expect(await screen.findByText("We couldn’t load your payments.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Your money" })).toBeNull();
    expect(screen.getByRole("region", { name: "Deals" })).toBeVisible();
  });
});

describe("HM-FR-15 the deals, Needs you first", () => {
  test("grouped, each row the brand and each post's step, linking to the deal", async () => {
    await openHome({
      deals: [aDeal(), aDeal({ id: "deal_glow", brandName: "Glow Theory", status: "Draft check", deliverables: [{ id: "del_glow", platform: "youtube_video", state: "check_failed" }] })],
    });
    const deals = await screen.findByRole("region", { name: "Deals" });
    const groups = within(deals).getAllByRole("region");
    expect(groups.map((g) => g.getAttribute("aria-labelledby") && within(g).getByRole("heading").textContent)).toEqual(["Needs you1", "Finished1"]);
    const glow = within(groups[0]).getByRole("link");
    expect(glow).toHaveAttribute("href", "/deals/deal_glow");
    expect(glow).toHaveTextContent("Glow TheoryYouTube videoDraft check");
    expect(within(groups[1]).getByRole("link")).toHaveTextContent("Kora AudioYouTube videoPaid");
  });
});

describe("HM-FR-08 to HM-FR-14 how you're doing", () => {
  const month = (m: string, onTime = true) =>
    aPayment({ deliverableId: `del_${m}`, publishedAt: `2026-${m}-10T12:00:00.000Z`, deadline: `2026-${m}-${onTime ? "20" : "05"}T12:00:00.000Z`, paidAt: `2026-${m}-12T12:00:00.000Z`, heldAt: `2026-${m}-01T12:00:00.000Z` });

  test("each figure as a label, a count and what it counts; paid each month with its text", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-15T12:00:00.000Z") });
    await openHome({ payments: [month("08"), month("09", false), month("10")] });
    const doing = await screen.findByRole("region", { name: "How you’re doing" });
    expect(within(doing).getByText("On time").parentElement).toHaveTextContent("On time2 of 3 postswent live before their deadline");
    expect(within(doing).getByText("Passed first time").parentElement).toHaveTextContent("Passed first time3 of 3 draftspassed every item on the first check");
    expect(within(doing).getByText("Time to paid").parentElement).toHaveTextContent("Time to paid2 dayson average, from posting to paid");
    expect(within(doing).getByText("On time by month: August 1 of 1, September 0 of 1, October 1 of 1")).toBeInTheDocument();
    const chart = within(doing).getByRole("region", { name: "Paid each month" });
    expect(within(chart).getByText("What you received")).toBeVisible();
    expect(within(chart).getByText("October so far: $760.00")).toBeInTheDocument();
    expect(within(chart).getByText("May: $0.00")).toBeInTheDocument();
    vi.useRealTimers();
  });

  test("a figure with nothing to count is left out, and so is the chart before anything is paid", async () => {
    await openHome({ payments: [aPayment({ stage: "held", payout: undefined, paidAt: undefined, publishedAt: undefined, firstCheckPassed: false })] });
    const doing = await screen.findByRole("region", { name: "How you’re doing" });
    expect(within(doing).getByText("Passed first time")).toBeVisible();
    expect(within(doing).queryByText("On time")).toBeNull();
    expect(within(doing).queryByText("Time to paid")).toBeNull();
    expect(within(doing).queryByRole("region", { name: "Paid each month" })).toBeNull();
    expect(within(doing).queryByText(/by month/)).toBeNull();
  });
});

describe("HM-FR-16 to HM-FR-19 the payment history", () => {
  const tide = aPayment({ dealId: "deal_tide", deliverableId: "del_tide", brandName: "=Tide Studio", platform: "youtube_short", amountMinor: 105000, feeMinor: 5250, receivedMinor: 99750, paidAt: "2026-09-24T12:00:00.000Z", payout: { state: "paid", reference: "8RT4410ZPA" }, holdReference: "3MV88201QD" });
  const screenWidth = (px: number) =>
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(min-width: 768px)" ? px >= 768 : query === "(min-width: 1024px)" ? px >= 1024 : false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));

  test("on a phone, one card per paid post, newest first, with every field", async () => {
    screenWidth(390);
    await openHome({ payments: [tide, aPayment(), aPayment({ deliverableId: "held", stage: "held", payout: undefined, paidAt: undefined })] });
    const history = await screen.findByRole("region", { name: "Payment history" });
    const cards = within(history).getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Kora Audio · YouTube video");
    expect(cards[0]).toHaveTextContent("Deal amount$800.00Cleared’s fee$40.00Received$760.00Payout reference5UX0294KQ1Hold reference7HK21934LM");
    expect(within(cards[0]).getByRole("link", { name: /Kora Audio/ })).toHaveAttribute("href", "/deals/deal_kora/deliverables/del_kora_video");
    expect(cards[1]).toHaveTextContent("=Tide Studio · Short");
  });

  test("from md:, the same rows in the grid", async () => {
    screenWidth(1280);
    await openHome({ payments: [tide, aPayment()] });
    const history = await screen.findByRole("region", { name: "Payment history" });
    const grid = await within(history).findByRole("grid");
    for (const name of ["Date paid", "Brand", "Post", "Deal amount", "Fee", "Received", "Payout reference", "Hold reference"]) {
      expect(within(grid).getByRole("columnheader", { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(await within(grid).findByText("5UX0294KQ1")).toBeInTheDocument();
    expect(within(grid).getByText("8RT4410ZPA")).toBeInTheDocument();
    expect(within(history).queryAllByRole("article")).toHaveLength(0);
  });

  test("Download CSV saves the whole history, escaped, named with today's date", async () => {
    screenWidth(390);
    const saved: Blob[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (b: Blob) => (saved.push(b), "blob:csv"), revokeObjectURL: () => {} }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^cleared-payments-\d{4}-\d{2}-\d{2}\.csv$/);
    });
    await openHome({ payments: [tide, aPayment()] });
    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(await screen.findByRole("button", { name: "Download CSV" }));
    expect(click).toHaveBeenCalled();
    const text = await saved[0].text();
    expect(text.split("\r\n").slice(0, 3)).toEqual([
      "Date paid,Brand,Post,Deal amount,Fee,Received,Payout reference,Hold reference",
      expect.stringMatching(/^2026-10-0\d,Kora Audio,YouTube video,800\.00,40\.00,760\.00,5UX0294KQ1,7HK21934LM$/),
      expect.stringMatching(/^2026-09-2\d,'=Tide Studio,Short,1050\.00,52\.50,997\.50,8RT4410ZPA,3MV88201QD$/),
    ]);
    click.mockRestore();
  });

  test("before anything is paid there is no history", async () => {
    await openHome({ payments: [aPayment({ stage: "held", payout: undefined, paidAt: undefined })] });
    await screen.findByRole("region", { name: "Your money" });
    expect(screen.queryByRole("region", { name: "Payment history" })).toBeNull();
  });
});

describe("HM-FR-04 the deals failing", () => {
  test("says so with Try again", async () => {
    stubSession(aProfile());
    server.use(http.get(`${apiBaseUrl}/deals`, () => HttpResponse.json({}, { status: 500 })));
    stubPayments([]);
    render(
      <AppShell currentDealId={null}>
        <HomePage payments />
      </AppShell>,
    );
    const main = await screen.findByRole("main");
    expect(await within(main).findByText("We couldn’t load your deals.")).toBeVisible();
    expect(within(main).getByRole("button", { name: "Try again" })).toBeVisible();
  });
});
