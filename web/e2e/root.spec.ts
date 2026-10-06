import { expect, test } from "@playwright/test";

// Tooling check: proves Playwright, the web server and both viewports are wired.
test("root page shows the wordmark without sideways scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Cleared" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
