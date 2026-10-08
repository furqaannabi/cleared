import { expect, test, type Page } from "@playwright/test";

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
const review = (page: Page) => page.getByRole("region", { name: "Your review" });
const next = (page: Page) => page.getByRole("region", { name: /What happens next|What to do next/ }).first();

test("RW: ask → accept → object → new draft → approve, on both sides", async ({ page }, testInfo) => {
  // The brand opens its link and sees each post's draft, the Reel's ask among what needs it.
  await page.goto("/b/demo_juniper");
  await expect(page).toHaveURL(/\/brand\/deals\/deal_juniper$/);
  const drafts = page.getByRole("region", { name: "Drafts" });
  await expect(drafts.getByRole("group", { name: "Instagram Reel" })).toContainText("Ada Okafor asked you about 1 item");

  // RW-FR-12, RW-FR-13: the brand accepts the Reel's Unsure item; its window starts.
  await drafts.getByRole("group", { name: "Instagram Reel" }).getByRole("link", { name: "Review draft" }).click();
  await expect(page).toHaveURL(/\/deliverables\/del_juniper_reel$/);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(review(page).getByText(/^Every item passed\./)).toBeVisible();

  // RW-FR-17, RW-FR-18: on the video, the brand objects to one item and sends it.
  await page.getByRole("link", { name: "Juniper & Salt × Ada Okafor" }).click();
  await drafts.getByRole("group", { name: "YouTube video" }).getByRole("link", { name: "Review draft" }).click();
  await page.getByRole("button", { name: /^Say the code TIDE15, Passed/ }).click();
  await page.getByRole("button", { name: "Object to Say the code TIDE15" }).click();
  await page.getByRole("textbox", { name: "What’s wrong with Say the code TIDE15?" }).fill("Say it slower.");
  await page.getByRole("button", { name: "Save objection" }).click();
  await noSidewaysScroll(page);
  await page.screenshot({ path: testInfo.outputPath("window.png"), fullPage: true });
  await review(page).getByRole("button", { name: "Send 1 objection to Ada Okafor" }).click();
  await review(page).getByRole("button", { name: "Yes, send" }).click();
  await expect(review(page).getByText("You asked Ada Okafor to fix 1 item.")).toBeVisible();

  // DC-FR-49, DC-FR-50: the creator sees the objection, and sends a new demo draft that passes.
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_video");
  await expect(next(page)).toContainText("Juniper & Salt asked you to fix 1 item.");
  await expect(page.getByText("The check passed this. Juniper & Salt asked you to change it:").first()).toBeVisible();
  await page.getByRole("combobox", { name: /the next draft/ }).selectOption("passes");
  await page.getByLabel("Upload new draft").first().setInputFiles({ name: "tide_video_v3.mp4", mimeType: "video/mp4", buffer: Buffer.from("x") });
  await expect(page.getByText(/^Every item passed\. Juniper & Salt has until /).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Copy link for Juniper & Salt" })).toBeVisible();

  // RW-FR-16: the brand approves the new draft; the creator is told not to publish yet.
  await page.goto("/brand/deals/deal_juniper/deliverables/del_juniper_video");
  await review(page).getByRole("button", { name: "Approve draft" }).click();
  await review(page).getByRole("button", { name: "Yes, approve" }).click();
  await expect(review(page).getByText(/^Approved by you · /)).toBeVisible();
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_video");
  await expect(page.getByRole("region", { name: "Draft approved" })).toContainText("Juniper & Salt approved this draft.");
  await expect(page.getByText("Don’t publish yet. Cleared confirms Juniper & Salt’s hold with PayPal first.").first()).toBeVisible();
  await noSidewaysScroll(page);
});

test("RW-FR-20: when the window runs out, the draft is approved and late objections aren't sent", async ({ page }) => {
  await page.goto("/b/review_del_juniper_video");
  await expect(page).toHaveURL(/\/brand\/deals\/deal_juniper\/deliverables\/del_juniper_video$/);
  await page.getByRole("button", { name: /^Code TIDE15 shown on screen, Passed/ }).click();
  await page.getByRole("button", { name: "Object to Code TIDE15 shown on screen" }).click();
  await page.getByRole("textbox", { name: "What’s wrong with Code TIDE15 shown on screen?" }).fill("Hold it longer.");
  await page.getByRole("button", { name: "Save objection" }).click();
  // Mock only: the window ends now.
  await page.evaluate(() => fetch("/api/__demo/review/del_juniper_video/end-window", { method: "POST" }));
  await review(page).getByRole("button", { name: "Send 1 objection to Ada Okafor" }).click();
  await review(page).getByRole("button", { name: "Yes, send" }).click();
  await expect(review(page).getByText(/so this draft is approved\. Your objections weren’t sent\./)).toBeVisible();
  await expect(review(page).getByText("Hold it longer.")).toBeVisible();
});
