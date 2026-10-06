import { expect, test } from "@playwright/test";

// Runs against the dev server with MSW mocks on (synthetic Glow Theory data).
test("DC-FR-35: the draft check page loads a deliverable without sideways scroll", async ({ page }) => {
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  await expect(page.getByRole("heading", { level: 1, name: "Glow Theory · YouTube video" })).toBeVisible();
  await expect(page.getByText("Fix 2 items, then upload a new draft.")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("DC-FR-38: an unknown deliverable shows the plain not-found page", async ({ page }) => {
  await page.goto("/deals/deal_glow/deliverables/del_nope");
  await expect(page.getByRole("heading", { level: 1, name: "We couldn’t find this deal" })).toBeVisible();
});
