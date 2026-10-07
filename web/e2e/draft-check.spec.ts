import { expect, test } from "@playwright/test";

// Runs against the dev server with MSW mocks on (synthetic Glow Theory data).
test("DC-FR-35: the draft check page loads a deliverable without sideways scroll", async ({ page }) => {
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  await expect(page.getByRole("heading", { level: 1, name: "Glow Theory · YouTube video" })).toBeVisible();
  await expect(page.getByRole("region", { name: "What to do next" }).getByText("Fix 1 item, and decide on 1 unsure item.")).toBeVisible();
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

test("DC-FR-45: on mocks, uploading a new draft runs a simulated check", async ({ page }) => {
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  await page.getByLabel("Upload new draft").setInputFiles({ name: "draft_v3.mp4", mimeType: "video/mp4", buffer: Buffer.from("x") });
  await expect(page.getByRole("region", { name: "What to do next" }).getByText(/We’re checking your draft against the 6 items/)).toBeVisible();
  await expect(page.getByRole("region", { name: "What to do next" }).getByText("Decide on 1 unsure item.")).toBeVisible({ timeout: 8000 });
});

test("DC-FR-31, DC-FR-37: move between deals from the rail (desktop) or the Deals sheet (phone)", async ({ page }, testInfo) => {
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  if (testInfo.project.name === "phone-375") {
    await page.getByRole("button", { name: "Deals" }).click();
    await page.getByRole("dialog", { name: "Deals" }).getByRole("link", { name: /Kora Audio/ }).click();
    await expect(page).toHaveURL(/\/deals\/deal_kora\/deliverables\/del_kora_reel$/);
    await expect(page.getByRole("heading", { level: 1, name: "Kora Audio · Instagram Reel" })).toBeVisible();
    await expect(page.getByRole("region", { name: "No draft yet" })).toBeVisible();
  } else {
    await page.getByRole("complementary", { name: "Main" }).getByRole("link", { name: /Northbound Coffee/ }).click();
    await expect(page).toHaveURL(/\/deals\/deal_nb\/deliverables\/del_nb_short$/);
    await expect(page.getByRole("heading", { level: 1, name: "Northbound Coffee · YouTube Short" })).toBeVisible();
  }
});

test("DC-FR-33: the switcher moves between a deal's deliverables", async ({ page }) => {
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  const switcher = page.getByRole("navigation", { name: "Deliverables in this deal" });
  await switcher.getByRole("link", { name: /Instagram Reel/ }).click();
  await expect(page).toHaveURL(/\/deals\/deal_glow\/deliverables\/del_glow_reel$/);
  await expect(page.getByRole("heading", { level: 1, name: "Glow Theory · Instagram Reel" })).toBeVisible();
  await expect(switcher.getByRole("link", { name: /Instagram Reel/ })).toHaveAttribute("aria-current", "page");
});

test("the checklist grid is one Tab stop: arrows move inside it, Tab moves past it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "phone-375", "the grid is tablet and up");
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  const grid = page.getByRole("grid");
  const cell = page.getByRole("row", { name: /Code GLOW20 shown on screen/ }).first().getByRole("gridcell").nth(1);
  await cell.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("row", { name: /Serum shown in use/ }).first().getByRole("gridcell").nth(1)).toBeFocused();
  await page.keyboard.press("Tab");
  const inGrid = await grid.evaluate((g) => g.contains(document.activeElement));
  expect(inGrid).toBe(false);
});

test("DC-FR-36: the selected item is in the URL, and Back returns to the previous one", async ({ page }, testInfo) => {
  await page.goto("/deals/deal_glow/deliverables/del_glow_video");
  const checklist = page.getByRole("region", { name: "Checklist" });
  if (testInfo.project.name === "phone-375") {
    await checklist.getByRole("button", { name: /Serum shown in use/ }).click();
  } else {
    await page.getByRole("row", { name: /Serum shown in use/ }).first().getByText("Serum shown in use").click();
  }
  await expect(page).toHaveURL(/\?item=it_6/);
  await page.goBack();
  await expect(page).not.toHaveURL(/item=/);
  await expect(page.getByRole("heading", { level: 1, name: "Glow Theory · YouTube video" })).toBeVisible();
});
