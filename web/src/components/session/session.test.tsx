import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { apiBaseUrl } from "@/lib/api";
import { signInAs } from "@/mocks/session";
import { SignInPage } from "./sign-in-page";

describe("SI-FR-06 a signed-out creator page", () => {
  test("sends the visitor to sign in, keeping where they were going, and never shows the page", async () => {
    signInAs(null);
    window.history.replaceState(null, "", "/deals/deal_glow/deliverables/del_glow_video?item=g1");
    render(
      <AppShell currentDealId="deal_glow">
        <p>Page content</p>
      </AppShell>,
    );
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Fdeals%2Fdeal_glow%2Fdeliverables%2Fdel_glow_video%3Fitem%3Dg1");
    expect(screen.queryByText("Page content")).toBeNull();
  });

  test("a signed-in creator sees the page", async () => {
    render(
      <AppShell currentDealId={null}>
        <p>Page content</p>
      </AppShell>,
    );
    expect(await screen.findByText("Page content")).toBeVisible();
  });
});

describe("SI-FR-01, SI-FR-02, SI-FR-05 the sign-in page", () => {
  test("the two ways in, each carrying a safe next to the backend", () => {
    render(<SignInPage next="/deals/new" />);
    expect(screen.getByRole("heading", { level: 1, name: "Sign in to see your deals" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toHaveAttribute("href", `${apiBaseUrl}/auth/google?next=%2Fdeals%2Fnew`);
    const demo = screen.getByRole("button", { name: "Try the demo account" });
    expect(demo.closest("form")).toHaveAttribute("action", `${apiBaseUrl}/auth/demo?next=%2Fdeals%2Fnew`);
    expect(demo.closest("form")).toHaveAttribute("method", "post");
    expect(screen.getByText("Instagram-only? Sign in with any Google account, then connect your Instagram.")).toBeVisible();
  });

  test("an unsafe next is dropped", () => {
    render(<SignInPage next="//evil.example" />);
    expect(screen.getByRole("link", { name: "Sign in with Google" })).toHaveAttribute("href", `${apiBaseUrl}/auth/google`);
  });
});
