import { expect, test, type Page } from "@playwright/test";

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

test("CN: the brand cancels the Juniper Reel with a note; the creator sees who and the note", async ({ page }, testInfo) => {
  await page.goto("/b/demo_juniper");
  await page.waitForURL(/\/brand\/deals\/deal_juniper$/);
  await page.goto("/brand/deals/deal_juniper/deliverables/del_juniper_reel");
  await page.getByRole("button", { name: "Cancel this post" }).first().click();
  const card = page.getByRole("region", { name: "Cancel this post?" });
  await expect(card).toContainText("Would come back to you");
  await card.getByRole("textbox", { name: "Add a note for Ada Okafor (optional)" }).fill("We’re pausing the campaign.");
  await noSidewaysScroll(page);
  await page.screenshot({ path: testInfo.outputPath("brand-confirm.png"), fullPage: true });
  await card.getByRole("button", { name: "Cancel the post" }).click();
  await expect(page.getByText(/Your \$600\.00 came back to you on \d+ \w+\. You cancelled this post\./).first()).toBeVisible();

  await page.goto("/deals/deal_juniper/deliverables/del_juniper_reel");
  await expect(page.getByText(/Juniper & Salt cancelled this post on \d+ \w+: “We’re pausing the campaign\.”/).first()).toBeVisible();
  await noSidewaysScroll(page);
});

test("CN-FR-14: the creator cancels Pine & Co's invite; the deal reads Cancelled", async ({ page }) => {
  await page.goto("/deals/deal_pine/invite");
  await page.getByRole("button", { name: "Cancel the deal" }).click();
  const card = page.getByRole("region", { name: "Cancel the deal?" });
  await card.getByRole("button", { name: "Cancel the deal" }).click();
  await expect(page.getByRole("heading", { name: "Cancelled before it was held" })).toBeVisible();
  await noSidewaysScroll(page);
});

test("CN-FR-03: the Short with the go-ahead can't be cancelled, and says why", async ({ page }) => {
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_short");
  await page.getByRole("region", { name: "From approved to paid" }).getByRole("button", { name: "Get the go-ahead" }).click();
  await expect(page.getByText("You can’t cancel now: you have the go-ahead to post.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel this post" })).toHaveCount(0);
});
