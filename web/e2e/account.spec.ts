import { expect, noSidewaysScroll, openNav, test } from "./live";

test("HM-FR-01, HM-FR-23 (1.2, 1.4): Overview and Payments, each in the rail and marked current on its page", async ({ page }) => {
  await page.goto("/deals");
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  await noSidewaysScroll(page);
  await openNav(page);
  await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Payments" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();
  // The test creator may or may not have been paid: either the history or the line saying nothing is paid yet.
  await expect(page.getByRole("region", { name: "Payment history" }).or(page.getByText("Nothing paid yet."))).toBeVisible();
  await noSidewaysScroll(page);
});

test("ST-FR-01, ST-FR-10 (1.3): Settings, with Delete account and the legal links", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Connected accounts" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "How deleting works" })).toHaveAttribute("href", "/data-deletion");
  await noSidewaysScroll(page);
});

for (const [path, title] of [
  ["/privacy", "Privacy policy"],
  ["/terms", "Terms"],
  ["/data-deletion", "Deleting your data"],
] as const) {
  test(`LG-FR-01, LG-FR-16 (1.1): ${path} reads at every width`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await noSidewaysScroll(page);
  });
}
