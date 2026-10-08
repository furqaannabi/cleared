import { test as base } from "@playwright/test";

/**
 * SI-FR-14: mock builds start signed out. Specs that use the creator app sign
 * in as the demo account first, the way a judge would, with "Try the demo account".
 */
export const test = base.extend<{ signedIn: void }>({
  signedIn: [
    async ({ page }, use) => {
      await page.goto("/sign-in");
      await page.getByRole("button", { name: "Try the demo account" }).click();
      await page.waitForURL(/\/deals\/./);
      await use();
    },
    { auto: true },
  ],
});
export { expect, type Page } from "@playwright/test";
