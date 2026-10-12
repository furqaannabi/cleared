import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { api } from "@/lib/api";
import { aProfile, stubSession } from "@/test/stub-api";

const desktop = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(min-width: 1024px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }));
afterEach(() => vi.unstubAllGlobals());
const shell = () =>
  render(
    <AppShell currentDealId={null}>
      <p>Page</p>
    </AppShell>,
  );

describe("SI-FR-11, SI-FR-12 the account menu", () => {
  test("the creator's name opens a menu with their email and Sign out, which signs out", async () => {
    const user = userEvent.setup();
    desktop();
    stubSession(aProfile({ name: "Sam Rivera", email: "sam.rivera@example.com" }));
    shell();
    const name = await screen.findByRole("button", { name: /Sam Rivera/ });
    expect(name).toHaveTextContent("Creator");
    expect(name).toHaveAttribute("aria-expanded", "false");
    await user.click(name);
    expect(name).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("sam.rivera@example.com")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(name).toHaveAttribute("aria-expanded", "false");
    expect(name).toHaveFocus();
    await user.click(name);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(async () => expect(await api.getProfile()).toEqual({ ok: false, error: "signed_out" }));
  });

  test("1.2: Settings sits between the email and Sign out", async () => {
    desktop();
    stubSession(aProfile({ name: "Sam Rivera", email: "sam.rivera@example.com" }));
    shell();
    await userEvent.click(await screen.findByRole("button", { name: /Sam Rivera/ }));
    const settings = screen.getByRole("link", { name: "Settings" });
    expect(settings).toHaveAttribute("href", "/settings");
    const order = [screen.getByText("sam.rivera@example.com"), settings, screen.getByRole("button", { name: "Sign out" })];
    expect(order.every((el, i) => i === 0 || order[i - 1].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  test("1.1: there is no demo account; a profile that still says demo shows the email and Sign out", async () => {
    const user = userEvent.setup();
    desktop();
    stubSession({ ...aProfile(), demo: true } as ReturnType<typeof aProfile>);
    shell();
    const name = await screen.findByRole("button", { name: /Ada Okafor/ });
    expect(name).not.toHaveTextContent("Demo account");
    await user.click(name);
    expect(screen.getByText("ada.okafor@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(screen.queryByText(/demo/i)).toBeNull();
  });
});
