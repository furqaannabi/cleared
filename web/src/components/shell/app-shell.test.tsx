import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { deals } from "@/test/fixtures/deals";
import { server } from "@/test/server";
import { aProfile, stubDeals, stubSession } from "@/test/stub-api";
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
    expect(within(rail).getByText("Cleared")).toBeVisible();
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


describe("DC-FR-31 (1.21) Overview and Payments", () => {
  test("Overview links to /deals and Payments to /payments, in the rail and the Deals sheet, each marked current on its page", async () => {
    screenWidth(1280);
    const { unmount } = render(
      <AppShell currentDealId={null} page="payments" payments>
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
      <AppShell currentDealId={null} page="overview" payments>
        <p>Overview</p>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Deals" }));
    const sheet = await screen.findByRole("dialog", { name: "Deals" });
    expect(within(sheet).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(within(sheet).getByRole("link", { name: "Payments" })).toHaveAttribute("href", "/payments");
    expect(within(sheet).queryByRole("link", { name: "Home" })).toBeNull();
  });

  test("with the payments flag off there is no Payments link", () => {
    screenWidth(1280);
    render(
      <AppShell currentDealId={null} page="overview" payments={false}>
        <p>Overview</p>
      </AppShell>,
    );
    const rail = screen.getByRole("complementary", { name: "Main" });
    expect(within(rail).getByRole("link", { name: "Overview" })).toBeVisible();
    expect(within(rail).queryByRole("link", { name: "Payments" })).toBeNull();
  });
});

describe("DC-FR-31 (1.20) the logo", () => {
  test.each([1280, 375])("links to the landing page at %ipx", (px) => {
    screenWidth(px);
    shell();
    expect(screen.getByRole("link", { name: "Cleared, home page" })).toHaveAttribute("href", "/");
  });
});
