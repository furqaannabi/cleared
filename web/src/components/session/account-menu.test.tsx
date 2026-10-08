import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { api } from "@/lib/api";
import { signInAs } from "@/mocks/session";

const desktop = () =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(min-width: 1024px)", media: query, addEventListener: () => {}, removeEventListener: () => {} }));
afterEach(() => vi.unstubAllGlobals());
const shell = () =>
  render(
    <AppShell currentDealId={null}>
      <p>Page</p>
    </AppShell>,
  );

describe("SI-FR-11 to SI-FR-13 the account menu", () => {
  test("the creator's name opens a menu with their email and Sign out, which signs out", async () => {
    const user = userEvent.setup();
    desktop();
    signInAs("new");
    shell();
    const name = await screen.findByRole("button", { name: /Sam Rivera/ });
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

  test("the demo account says so, and offers Leave the demo", async () => {
    const user = userEvent.setup();
    desktop();
    shell();
    const name = await screen.findByRole("button", { name: /Ada Okafor/ });
    expect(name).toHaveTextContent("Demo account");
    await user.click(name);
    expect(screen.getByRole("button", { name: "Leave the demo" })).toBeVisible();
  });
});
