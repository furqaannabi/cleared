import { expect, test, type Page } from "@playwright/test";

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

test("SI: Sign in with Google the first time → welcome → connect YouTube → Start your first deal", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "Sign in with Google" }).first().click();
  await page.waitForURL(/\/welcome$/);
  await expect(page.getByRole("heading", { level: 1, name: "Get paid for every brand deal, on time." })).toBeVisible();
  const setup = page.getByRole("region", { name: "Set up in a minute" });
  await setup.getByRole("button", { name: "Connect YouTube" }).click();
  await expect(setup.getByText("Connected as Sam Rivera")).toBeVisible();
  await expect(setup).toContainText("1 of 3 done");
  await noSidewaysScroll(page);
  await page.screenshot({ path: testInfo.outputPath("welcome.png"), fullPage: true });
  await page.getByRole("link", { name: "Start your first deal" }).click();
  await page.waitForURL(/\/deals\/new$/);
  // Shown once: back at /welcome, the creator is sent to their deals.
  await page.goto("/welcome");
  await page.waitForURL(/\/deals/);
});

test("SI-FR-02, SI-FR-13: Try the demo account → the demo's deals → Leave the demo → the landing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Try the demo account" }).first().click();
  await page.waitForURL(/\/deals\/deal_glow\//);
  const isDesktop = (page.viewportSize()?.width ?? 0) >= 1024;
  if (!isDesktop) await page.getByRole("button", { name: "Deals" }).click();
  await page.getByRole("button", { name: /Ada Okafor/ }).click();
  await page.getByRole("button", { name: "Leave the demo" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/deals");
  await page.waitForURL(/\/sign-in\?next=%2Fdeals/);
});

test("SI-FR-06: a signed-out bookmarked deal → sign in → back on that deal", async ({ page }) => {
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_short");
  await page.waitForURL(/\/sign-in\?next=/);
  await expect(page.getByRole("heading", { level: 1, name: "Sign in to see your deals" })).toBeVisible();
  await noSidewaysScroll(page);
  await page.getByRole("button", { name: "Try the demo account" }).click();
  await page.waitForURL(/\/deals\/deal_juniper\/deliverables\/del_juniper_short$/);
  await expect(page.getByRole("heading", { level: 1, name: "Juniper & Salt · YouTube Short" })).toBeVisible();
});
