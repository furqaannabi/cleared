import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { deals } from "@/test/fixtures/deals";
import { server } from "@/test/server";
import { aProfile, stubDeals, stubPayments, stubSession } from "@/test/stub-api";
import { aPayment } from "@/lib/home/test-rows";
import { AppShell } from "./app-shell";

function screenWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(min-width: 1024px)" ? px >= 1024 : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  stubSession(aProfile());
  stubDeals(deals);
  stubPayments([]);
});

const shell = () =>
  render(
    <AppShell currentDealId="deal_glow">
      <p>Page content</p>
    </AppShell>,
  );

describe("DC-FR-31 app shell", () => {
  test("on desktop, an espresso rail with the logo and the deals", async () => {
    screenWidth(1280);
    shell();
    const rail = screen.getByRole("complementary", { name: "Main" });
    expect(within(rail).getByText("Sponing")).toBeVisible();
    expect(await within(rail).findByRole("link", { name: /Northbound Coffee/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Deals" })).toBeNull();
    expect(screen.getByText("Page content")).toBeVisible();
  });

  test("on tablet and phone, a top bar whose Deals button opens the deals in a sheet", async () => {
    screenWidth(375);
    shell();
    expect(screen.queryByRole("complementary", { name: "Main" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Deals" }));
    const sheet = screen.getByRole("dialog", { name: "Deals" });
    expect(await within(sheet).findByRole("link", { name: /Kora Audio/ })).toBeVisible();
  });

  test("if the deals can't load, it says so rather than showing an empty list", async () => {
    screenWidth(1280);
    server.use(http.get(`${apiBaseUrl}/deals`, () => HttpResponse.json({}, { status: 500 })));
    shell();
    expect(await screen.findByText("We couldn’t load your deals.")).toBeVisible();
  });

  test("a skip link to the page content comes first, at every width", () => {
    for (const px of [1280, 375]) {
      screenWidth(px);
      const { unmount } = shell();
      const skip = screen.getByRole("link", { name: "Skip to content" });
      expect(skip).toHaveAttribute("href", "#main");
      expect(document.querySelector("a, button")).toBe(skip);
      unmount();
    }
  });

  test("the rail's Deals label is not a heading, so the page's h1 is the first heading", async () => {
    screenWidth(1280);
    shell();
    expect(screen.queryByRole("heading", { name: "Deals" })).toBeNull();
    expect(await screen.findByRole("navigation", { name: "Deals" })).toBeInTheDocument();
  });

  test("BC-FR-01: New deal in the rail on desktop, and in the Deals sheet on phones", async () => {
    screenWidth(1280);
    const { unmount } = shell();
    expect(within(screen.getByRole("complementary", { name: "Main" })).getByRole("link", { name: "New deal" })).toHaveAttribute("href", "/deals/new");
    unmount();
    screenWidth(375);
    shell();
    await userEvent.click(screen.getByRole("button", { name: "Deals" }));
    expect(within(await screen.findByRole("dialog", { name: "Deals" })).getByRole("link", { name: "New deal" })).toHaveAttribute("href", "/deals/new");
  });
});


describe("DC-FR-31 (1.21, 1.22) Overview and Payments, always", () => {
  test("Overview links to /deals and Payments to /payments, in the rail and the Deals sheet, each marked current on its page", async () => {
    screenWidth(1280);
    const { unmount } = render(
      <AppShell currentDealId={null} page="payments">
        <p>Payments</p>
      </AppShell>,
    );
    const rail = screen.getByRole("complementary", { name: "Main" });
    const links = within(rail).getAllByRole("link").map((l) => l.textContent);
    expect(links.indexOf("Payments")).toBe(links.indexOf("Overview") + 1);
    expect(within(rail).getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/deals");
    expect(within(rail).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(within(rail).getByRole("link", { name: "Payments" })).toHaveAttribute("href", "/payments");
    expect(within(rail).getByRole("link", { name: "Payments" })).toHaveAttribute("aria-current", "page");
    unmount();
    screenWidth(375);
    render(
      <AppShell currentDealId={null} page="overview">
        <p>Overview</p>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Deals" }));
    const sheet = await screen.findByRole("dialog", { name: "Deals" });
    expect(within(sheet).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(within(sheet).getByRole("link", { name: "Payments" })).toHaveAttribute("href", "/payments");
    expect(within(sheet).queryByRole("link", { name: "Home" })).toBeNull();
  });
});

describe("DC-FR-31 (1.20) the logo", () => {
  test.each([1280, 375])("links to the landing page at %ipx", (px) => {
    screenWidth(px);
    shell();
    expect(screen.getByRole("link", { name: "Sponing, home page" })).toHaveAttribute("href", "/");
  });
});

describe("DC-FR-55 (1.23) folding the rail", () => {
  const rail = () => screen.getByRole("complementary", { name: "Main" });
  const open = () =>
    render(
      <AppShell currentDealId="deal_glow" page="overview">
        <p>Page content</p>
        <input aria-label="A field" />
      </AppShell>,
    );
  afterEach(() => window.localStorage.clear());

  test("the button folds it to icons that keep their names, drops the deals' status, and is remembered", async () => {
    screenWidth(1280);
    const { unmount } = open();
    const fold = within(rail()).getByRole("button", { name: "Collapse sidebar" });
    expect(fold).toHaveAttribute("aria-expanded", "true");
    expect(await within(rail()).findByText("Draft check")).toBeVisible();
    await userEvent.click(fold);
    const unfold = within(rail()).getByRole("button", { name: "Expand sidebar" });
    expect(unfold).toHaveAttribute("aria-expanded", "false");
    for (const name of ["New deal", "Overview", "Payments", "Glow Theory"]) expect(within(rail()).getByRole("link", { name: new RegExp(name) })).toBeInTheDocument();
    expect(within(rail()).queryByText("Draft check")).toBeNull();
    // DC-FR-31 (1.26): folded, the dot stays on the avatar.
    expect(within(rail()).getByRole("link", { name: /Glow Theory/ })).toHaveTextContent("Needs you");
    // DC-FR-55 (1.24): at the top of the rail, before New deal.
    const order = Array.from(rail().querySelectorAll("a, button")).map((el) => el.getAttribute("aria-label") ?? el.textContent);
    expect(order.indexOf("Expand sidebar")).toBeLessThan(order.findIndex((n) => n?.includes("New deal")));
    unmount();
    open();
    expect(within(rail()).getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  });

  test("[ folds and unfolds it, but not while typing in a field", async () => {
    screenWidth(1280);
    open();
    await userEvent.keyboard("[[");
    expect(within(rail()).getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await userEvent.click(screen.getByRole("textbox", { name: "A field" }));
    await userEvent.keyboard("[[");
    expect(within(rail()).getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await userEvent.click(screen.getByText("Page content"));
    await userEvent.keyboard("[[");
    expect(within(rail()).getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  });

  test("with storage blocked it opens unfolded", () => {
    screenWidth(1280);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    open();
    expect(within(rail()).getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
    vi.restoreAllMocks();
  });

  test("below lg: there is nothing to fold", () => {
    screenWidth(375);
    open();
    expect(screen.queryByRole("button", { name: /Collapse sidebar|Expand sidebar/ })).toBeNull();
  });
});

describe("DC-FR-31 (1.26) needs you", () => {
  const needsYou = (name: RegExp) => within(screen.getByRole("navigation", { name: "Deals" })).getByRole("link", { name }).textContent?.includes("Needs you");

  test("in the rail, the deals whose posts need the creator, and one with a payout that didn't go through, say Needs you; the others don't", async () => {
    screenWidth(1280);
    stubPayments([aPayment({ dealId: "deal_wren", deliverableId: "del_wren_video", stage: "captured", payout: { state: "failed" }, paidAt: undefined })]);
    shell();
    await screen.findByRole("link", { name: /Northbound Coffee/ });
    expect(needsYou(/Glow Theory/)).toBe(true);
    expect(needsYou(/Kora Audio/)).toBe(true);
    expect(needsYou(/Northbound Coffee/)).toBe(false);
    await waitFor(() => expect(needsYou(/Wren Coffee/)).toBe(true));
  });

  test("on phones, the Deals button says a deal needs the creator", async () => {
    screenWidth(375);
    shell();
    expect(await screen.findByRole("button", { name: "Deals, a deal needs you" })).toBeVisible();
  });

  test("with nothing needing the creator, no dot anywhere", async () => {
    screenWidth(375);
    stubDeals(deals.map((d) => ({ ...d, deliverables: d.deliverables.map((p) => ({ ...p, needsCreator: false })) })));
    shell();
    await userEvent.click(await screen.findByRole("button", { name: "Deals" }));
    expect(within(screen.getByRole("dialog", { name: "Deals" })).queryByText("Needs you")).toBeNull();
  });
});
