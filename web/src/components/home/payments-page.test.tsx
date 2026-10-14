import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { apiBaseUrl } from "@/lib/api";
import type { PaymentRow } from "@/lib/home/payment-row";
import { aPayment } from "@/lib/home/test-rows";
import { server } from "@/test/server";
import { aProfile, stubDeals, stubPayments, stubSession } from "@/test/stub-api";
import { PaymentsPage } from "./payments-page";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const screenWidth = (px: number) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(min-width: 768px)" ? px >= 768 : query === "(min-width: 1024px)" ? px >= 1024 : false, media: query, addEventListener: () => {}, removeEventListener: () => {} }));

/** Payments in the creator frame, signed in, with these payments (null: the route fails). */
async function openPayments(payments: PaymentRow[] | null = [aPayment()]) {
  stubSession(aProfile());
  stubDeals([]);
  if (payments) stubPayments(payments);
  else server.use(http.get(`${apiBaseUrl}/me/payments`, () => HttpResponse.json({}, { status: 500 })));
  render(
    <AppShell currentDealId={null} page="payments">
      <PaymentsPage />
    </AppShell>,
  );
  await screen.findByRole("heading", { level: 1, name: "Payments" });
}

const tide = aPayment({ dealId: "deal_tide", deliverableId: "del_tide", brandName: "=Tide Studio", platform: "youtube_short", amountMinor: 105000, feeMinor: 5250, receivedMinor: 99750, paidAt: "2026-09-24T12:00:00.000Z", payout: { state: "paid", reference: "8RT4410ZPA" }, holdReference: "3MV88201QD" });
const held = (amountMinor: number) => aPayment({ deliverableId: `held_${amountMinor}`, stage: "held", payout: undefined, paidAt: undefined, amountMinor, feeMinor: undefined, receivedMinor: undefined });
const onItsWay = (receivedMinor: number) => aPayment({ deliverableId: `way_${receivedMinor}`, stage: "captured", payout: { state: "sending" }, paidAt: undefined, receivedMinor });

describe("HM-FR-23, HM-FR-24 the page and the year", () => {
  test("the line for the year under the title, the total in bold", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-15T12:00:00.000Z") });
    await openPayments([tide, aPayment()]);
    const year = await screen.findByText(/received in 2026/);
    expect(year).toHaveTextContent("$1,757.50 received in 2026 · 2 posts");
    expect(within(year).getByText("$1,757.50").tagName).toBe("B");
  });

  test("left out while nothing has been paid this year", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2027-01-03T12:00:00.000Z") });
    await openPayments([aPayment()]);
    await screen.findByRole("region", { name: "Payment history" });
    expect(screen.queryByText(/received in/)).toBeNull();
  });

  test("then Paid each month, with its text for screen readers, then the history", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-15T12:00:00.000Z") });
    await openPayments([aPayment()]);
    const chart = await screen.findByRole("region", { name: "Paid each month" });
    expect(within(chart).getByText("What you received")).toBeVisible();
    expect(within(chart).getByText("October so far: $760.00")).toBeInTheDocument();
    expect(within(chart).getByText("May: $0.00")).toBeInTheDocument();
    const history = screen.getByRole("region", { name: "Payment history" });
    expect(Boolean(chart.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  test("HM-FR-04: payments failing says so with Try again", async () => {
    await openPayments(null);
    expect(await screen.findByText("We couldn’t load your payments.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

describe("HM-FR-26 nothing paid yet", () => {
  test("says what will show here, and what is held and on its way, linking to the overview; no chart, grid or CSV", async () => {
    await openPayments([held(120000), onItsWay(45000)]);
    expect(await screen.findByText("Nothing paid yet.")).toBeVisible();
    expect(screen.getByText("Each post you’re paid for shows here with its PayPal references, ready to download.")).toBeVisible();
    expect(screen.getByText(/is held for you/).closest("p")).toHaveTextContent("$1,200.00 is held for you and $450.00 is on its way.");
    expect(screen.getByRole("link", { name: "See your overview" })).toHaveAttribute("href", "/deals");
    expect(screen.queryByRole("region", { name: "Paid each month" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Payment history" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Download CSV" })).toBeNull();
  });

  test("a part that is zero is left out, and with nothing held or on its way there is no third line", async () => {
    await openPayments([held(120000)]);
    expect((await screen.findByText(/is held for you/)).closest("p")).toHaveTextContent("$1,200.00 is held for you.");
  });

  test("with no money at all, only the first two lines", async () => {
    await openPayments([]);
    expect(await screen.findByText("Nothing paid yet.")).toBeVisible();
    expect(screen.queryByText(/is held for you|is on its way/)).toBeNull();
    expect(screen.queryByRole("link", { name: "See your overview" })).toBeNull();
  });
});

describe("HM-FR-16 to HM-FR-19 the payment history", () => {
  test("on a phone, one card per paid post, newest first, with every field", async () => {
    screenWidth(390);
    await openPayments([tide, aPayment(), held(50000)]);
    const history = await screen.findByRole("region", { name: "Payment history" });
    const cards = within(history).getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Kora Audio · YouTube video");
    expect(cards[0]).toHaveTextContent("Deal amount$800.00Sponing’s fee$40.00Received$760.00Payout reference5UX0294KQ1Hold reference7HK21934LM");
    expect(within(cards[0]).getByRole("link", { name: /Kora Audio/ })).toHaveAttribute("href", "/deals/deal_kora/deliverables/del_kora_video");
    expect(cards[1]).toHaveTextContent("=Tide Studio · Short");
  });

  test("from md:, the same rows in the grid", async () => {
    screenWidth(1280);
    await openPayments([tide, aPayment()]);
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
      expect(this.download).toMatch(/^sponing-payments-\d{4}-\d{2}-\d{2}\.csv$/);
    });
    await openPayments([tide, aPayment()]);
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
});
