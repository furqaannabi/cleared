import { expect, test, type Page } from "@playwright/test";

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

/*
 * SI 1.1: Sign in with Google is the backend's, so these runs never follow
 * it. Signed-in runs against the live backend wait for Furqaan's test
 * session (SI Requests); until then the mock creator starts signed in.
 */

test("LP-FR-03, SI-FR-01 (1.3, 1.1): the landing has one way in, to the backend's Google sign-in", async ({ page }) => {
  await page.goto("/");
  const google = page.getByRole("main").getByRole("link", { name: "Sign in with Google" });
  await expect(google).toHaveCount(2);
  for (const g of await google.all()) await expect(g).toHaveAttribute("href", /\/auth\/google\?next=%2Fdeals$/);
  await expect(page.getByText("Try the demo account")).toHaveCount(0);
  await noSidewaysScroll(page);
});

test("SI-FR-12, SI-FR-06: Sign out → the landing; a bookmarked deal then asks to sign in, keeping where it was going", async ({ page }) => {
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_short");
  await expect(page.getByRole("heading", { level: 1, name: "Juniper & Salt · YouTube Short" })).toBeVisible();
  const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;
  if (!isDesktop) await page.getByRole("button", { name: "Deals" }).click();
  await page.getByRole("button", { name: /Ada Okafor/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/");

  await page.goto("/deals/deal_juniper/deliverables/del_juniper_short");
  await page.waitForURL(/\/sign-in\?next=%2Fdeals%2Fdeal_juniper%2Fdeliverables%2Fdel_juniper_short$/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to see your deals" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in with Google" })).toHaveAttribute(
    "href",
    /\/auth\/google\?next=%2Fdeals%2Fdeal_juniper%2Fdeliverables%2Fdel_juniper_short$/,
  );
  await noSidewaysScroll(page);
});
