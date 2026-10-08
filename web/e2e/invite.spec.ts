import { expect, test, type Page } from "@playwright/test";

const BRIEF = [
  "In the YouTube video, say “Glow Theory” in the first 60 seconds.",
  "Say and show the code GLOW20.",
  "Put #GlowPartner in the Reel caption.",
  "Mark the post as a paid promotion.",
].join("\n");

/** New deal → brief → checklist ready, all in one page session (the browser mocks live in it). */
async function readyChecklist(page: Page) {
  await page.goto("/deals/new");
  await page.getByLabel("Brand", { exact: true }).fill("Glow Theory");
  await page.getByRole("button", { name: "Add another post" }).click();
  await page.getByLabel("Post 2", { exact: true }).selectOption("instagram_reel");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Paste the brief Glow Theory sent").fill(BRIEF);
  await page.getByRole("button", { name: "Make the checklist" }).click();
  await page.getByRole("button", { name: "Checklist ready" }).click({ timeout: 15_000 });
}

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

test("IN: checklist ready → invite → amounts, deadlines, Instagram → link → change terms", async ({ page, context }, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await readyChecklist(page);
  await page.getByRole("link", { name: "Set amounts and invite Glow Theory" }).click();
  await expect(page).toHaveURL(/\/deals\/deal_\w+\/invite$/);
  await expect(page.getByRole("heading", { level: 1, name: "Glow Theory · Invite" })).toBeVisible();
  await noSidewaysScroll(page);

  await page.getByRole("textbox", { name: "Amount for the YouTube video", exact: true }).fill("1200");
  await page.getByRole("spinbutton", { name: "Days after the hold for the YouTube video", exact: true }).fill("14");
  await page.getByRole("textbox", { name: "Amount for the Instagram Reel", exact: true }).fill("450");
  await page.getByRole("spinbutton", { name: "Days after the hold for the Instagram Reel", exact: true }).fill("10");
  await page.getByRole("textbox", { name: "Glow Theory’s email (optional)", exact: true }).click();
  await expect(page.getByText("$1,650.00", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Glow Theory’s email (optional)", exact: true }).fill("sam@glowtheory.com");
  await page.getByRole("button", { name: "Connect Instagram" }).click();
  await expect(page.getByText("Instagram connected as ada.makes")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("editing.png"), fullPage: true });

  await page.getByRole("button", { name: "Create link for Glow Theory" }).click();
  const panel = page.getByRole("region", { name: "Send this link to Glow Theory" });
  await expect(panel.getByText("We’ve also emailed it to sam@glowtheory.com.")).toBeVisible();
  await panel.getByRole("button", { name: "Copy link" }).click();
  await expect(panel.getByText("Copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^https:\/\/cleared\.example\/b\//);
  if (testInfo.project.name === "desktop-1280") {
    await expect(page.getByRole("navigation", { name: "Deals" }).getByRole("link", { name: /Glow Theory/ }).getByText("Waiting for brand")).toBeVisible();
  }
  await noSidewaysScroll(page);
  await page.screenshot({ path: testInfo.outputPath("link.png"), fullPage: true });

  await page.getByRole("button", { name: "Change terms" }).click();
  await page.getByRole("button", { name: "Yes, change terms" }).click();
  await expect(page.getByRole("textbox", { name: "Amount for the YouTube video", exact: true })).toHaveValue("1,200.00");
});
