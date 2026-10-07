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

test("DC-FR-40: the checklist is a grid from md: up and cards on phones", async ({ page }, testInfo) => {
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  const checklist = page.getByRole("region", { name: "Checklist" });
  if (testInfo.project.name === "phone-375") {
    await expect(checklist.getByRole("button", { name: /Code GLOW20 shown on screen/ })).toBeVisible();
    await expect(checklist.getByRole("grid")).toHaveCount(0);
  } else {
    await expect(checklist.getByRole("grid")).toBeVisible();
    await expect(checklist.getByRole("row", { name: /Code GLOW20 shown on screen/ }).first()).toBeVisible();
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("DC-FR-14, DC-FR-15: ask the brand to accept the Unsure item, then withdraw", async ({ page }, testInfo) => {
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  const phone = testInfo.project.name === "phone-375";
  if (phone) await page.getByRole("region", { name: "Checklist" }).getByRole("button", { name: /Serum shown in use/ }).click();
  else await page.getByRole("row", { name: /Serum shown in use/ }).first().click();

  await page.getByRole("button", { name: "Ask Glow Theory to accept" }).click();
  await expect(page.getByText(/You asked just now/)).toBeVisible();
  await page.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByRole("button", { name: "Ask Glow Theory to accept" })).toBeVisible();
});
