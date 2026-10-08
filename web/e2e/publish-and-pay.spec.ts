import { expect, test, type Page } from "./signed-in";

const journey = (page: Page) => page.getByRole("region", { name: "From approved to paid" });
const review = (page: Page) => page.getByRole("region", { name: "Your review" });
const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

test("PP: go-ahead → posted → the check can't decide → the brand confirms → captured → paid", async ({ page }, testInfo) => {
  // The creator's approved Short: get the go-ahead.
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_short");
  await journey(page).getByRole("button", { name: "Get the go-ahead" }).click();
  await expect(journey(page).getByText("You can post now", { exact: true })).toBeVisible();
  await noSidewaysScroll(page);
  await page.screenshot({ path: testInfo.outputPath("go-ahead.png"), fullPage: true });

  // Demo: the live check can't decide. The creator posts.
  await page.getByRole("combobox", { name: /the live check finds/ }).selectOption("undecided");
  await journey(page).getByRole("button", { name: "I’ve posted it" }).click();
  await journey(page).getByRole("button", { name: "Yes, it’s public" }).click();
  await expect(journey(page).getByText("Juniper & Salt to confirm", { exact: true })).toBeVisible({ timeout: 10_000 });

  // The brand confirms the post from its deal page.
  await page.goto("/b/demo_juniper");
  const drafts = page.getByRole("region", { name: "Drafts" });
  await expect(drafts.getByRole("group", { name: "YouTube Short" })).toContainText("Confirm the post");
  await drafts.getByRole("group", { name: "YouTube Short" }).getByRole("link", { name: "Review post" }).click();
  await expect(page.getByRole("link", { name: "View the live post" })).toBeVisible();
  await review(page).getByRole("button", { name: "Confirm the post" }).click();
  await review(page).getByRole("button", { name: "Yes, confirm" }).click();
  await expect(review(page).getByText(/was taken on/)).toBeVisible();
  await noSidewaysScroll(page);

  // The creator sees the capture, then the payout land.
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_short");
  await expect(journey(page).getByText("Paid $332.50 to ada@example.com", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(journey(page)).toContainText("Cleared");
  await page.screenshot({ path: testInfo.outputPath("paid.png"), fullPage: true });
});

test("PP-FR-12: something to fix on the live post, fixed and checked again, then paid", async ({ page }) => {
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_short");
  await journey(page).getByRole("button", { name: "Get the go-ahead" }).click();
  await page.getByRole("combobox", { name: /the live check finds/ }).selectOption("fixable");
  await journey(page).getByRole("button", { name: "I’ve posted it" }).click();
  await journey(page).getByRole("button", { name: "Yes, it’s public" }).click();
  await expect(journey(page).getByText("1 item to fix on your live post", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("combobox", { name: /the live check finds/ }).selectOption("passed");
  await journey(page).getByRole("button", { name: "Check again" }).click();
  await expect(journey(page).getByText("Paid $332.50 to ada@example.com", { exact: true })).toBeVisible({ timeout: 15_000 });
});

test("PP-FR-35: a payout PayPal won't send is delayed on Cleared's side; tried again, it's paid", async ({ page }, testInfo) => {
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_short");
  await journey(page).getByRole("button", { name: "Get the go-ahead" }).click();
  await page.getByRole("combobox", { name: /the payout is/ }).selectOption("wont_send");
  await journey(page).getByRole("button", { name: "I’ve posted it" }).click();
  await journey(page).getByRole("button", { name: "Yes, it’s public" }).click();
  await expect(journey(page).getByText("Sending $332.50 to ada@example.com is delayed", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(journey(page)).toContainText("There’s nothing you need to do.");
  await noSidewaysScroll(page);
  await page.screenshot({ path: testInfo.outputPath("delayed.png"), fullPage: true });
  await page.getByRole("button", { name: "Try the payout again now" }).click();
  await expect(journey(page).getByText("Paid $332.50 to ada@example.com", { exact: true })).toBeVisible({ timeout: 15_000 });
});
