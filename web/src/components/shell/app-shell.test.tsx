import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
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
});
