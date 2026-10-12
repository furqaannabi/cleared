import { expect, test as plain } from "@playwright/test";
import { noSidewaysScroll, openNav, test } from "./live";

/* SI 1.1: Sign in with Google is the backend's, so these runs never follow it; signed-in runs use the test session (AH-FR-27). */

plain("LP-FR-03, SI-FR-01 (1.3, 1.1): the landing has one way in, to the backend's Google sign-in", async ({ page }) => {
  await page.goto("/");
  const google = page.getByRole("main").getByRole("link", { name: "Sign in with Google" });
  await expect(google.first()).toHaveAttribute("href", /\/auth\/google\?next=%2Fdeals$/);
  await expect(page.getByText("Try the demo account")).toHaveCount(0);
  await noSidewaysScroll(page);
});

test("SI-FR-12, SI-FR-06: Sign out → the landing; the overview then asks to sign in, keeping where it was going", async ({ page }) => {
  await page.goto("/deals");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await openNav(page);
  await page.getByRole("button", { name: /Creator/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/");

  await page.goto("/deals");
  await page.waitForURL(/\/sign-in\?next=%2Fdeals$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to see your deals" })).toBeVisible();
  await expect(page.getByRole("link", { name: "terms" })).toHaveAttribute("href", "/terms");
  await noSidewaysScroll(page);
});
