import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BrandFrame } from "@/components/brand-deal/brand-frame";
import { LandingPage } from "@/components/landing/landing-page";
import { SignInPage } from "@/components/session/sign-in-page";
import { SettingsPage } from "@/components/settings/settings-page";
import { AppShell } from "@/components/shell/app-shell";
import { aProfile, stubSession } from "@/test/stub-api";

afterEach(() => vi.unstubAllEnvs());

async function settings() {
  stubSession(aProfile());
  render(
    <AppShell currentDealId={null}>
      <SettingsPage />
    </AppShell>,
  );
  await screen.findByRole("heading", { level: 1, name: "Settings" });
}

describe("LG-FR-15 (1.1) the links, always", () => {
  test("LP 1.7: the landing footer links all three", () => {
    render(<LandingPage />);
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(within(footer).getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(within(footer).getByRole("link", { name: "Data deletion" })).toHaveAttribute("href", "/data-deletion");
  });

  test("SI 1.3: the sign-in page says signing in agrees to the terms and privacy policy", () => {
    render(<SignInPage next={null} />);
    const line = screen.getByText(/By signing in you agree to the/);
    expect(line).toHaveTextContent("By signing in you agree to the terms and privacy policy.");
    expect(within(line).getByRole("link", { name: "terms" })).toHaveAttribute("href", "/terms");
    expect(within(line).getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  test("ST 1.2: Settings has Privacy policy and Terms beside Sign out, and How deleting works in Delete account", async () => {
    await settings();
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "How deleting works" })).toHaveAttribute("href", "/data-deletion");
    void userEvent;
  });

  test("CH 1.5: the brand's pages end with the three links", () => {
    render(
      <BrandFrame>
        <p>Deal</p>
      </BrandFrame>,
    );
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/privacy", "/terms", "/data-deletion"]);
  });
});
