import { expect, test } from "@playwright/test";

test("LP-FR-07: the landing page has no sideways scroll, and the button is on the first screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("clear together");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  const button = page.getByRole("main").getByRole("link", { name: "See a deal in action" }).first();
  const box = await button.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test("LP-FR-03, LP-FR-15: See a deal in action opens the demo deal", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("main").getByRole("link", { name: "See a deal in action" }).first().click();
  await expect(page).toHaveURL(/\/deals\/deal_glow\/deliverables\/del_glow_video/);
  await expect(page.getByRole("heading", { level: 1, name: "Glow Theory · YouTube video" })).toBeVisible();
});
