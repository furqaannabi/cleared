import { expect, test } from "@playwright/test";

test("LP-FR-07: the landing page has no sideways scroll, and the button is on the first screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("clear together");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  const button = page.getByRole("main").getByRole("link", { name: "Sign in with Google" }).first();
  const box = await button.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

for (const width of [375, 1100]) {
  test(`LP-FR-07: the problem and closing cards keep a gutter from the screen edge at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const id of ["problem-heading", "close-heading"]) {
      const card = page.locator(`section[aria-labelledby="${id}"]`);
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(16);
      expect(width - (box.x + box.width)).toBeGreaterThanOrEqual(16);
    }
  });
}

test("EP-FR-01: an unknown address is a 404 with Cleared's not-found page", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "We can’t find that page" })).toBeVisible();
});
