import { expect, test } from "@playwright/test";

const BRIEF = [
  "Thanks for partnering with Glow Theory on the Dew Drop serum launch!",
  "In the YouTube video, say “Glow Theory” in the first 60 seconds.",
  "Mention us early in the Reel.",
  "Say and show the code GLOW20.",
  "Keep it fun and authentic!",
  "Mark the post as a paid promotion.",
].join("\n");

test("BC: new deal → brief → reading → answer the questions → checklist ready", async ({ page }, testInfo) => {
  await page.goto("/deals/new");
  await page.getByLabel("Brand", { exact: true }).fill("Glow Theory");
  await page.getByRole("button", { name: "Add another post" }).click();
  await page.getByLabel("Post 2", { exact: true }).selectOption("instagram_reel");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/deals\/deal_\w+\/checklist$/);

  await page.getByLabel("Paste the brief Glow Theory sent").fill(BRIEF);
  await page.getByRole("button", { name: "Make the checklist" }).click();
  await expect(page.getByRole("region", { name: "Reading your brief" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2 questions to answer" })).toBeVisible({ timeout: 15_000 });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  if (testInfo.project.name === "desktop-1280") await expect(page.getByRole("heading", { name: "The brief" })).toBeVisible();

  await page.getByRole("button", { name: "In the first 10 seconds" }).click();
  await expect(page.getByRole("heading", { name: "1 question to answer" })).toBeVisible();
  await page.getByRole("button", { name: "Leave it out" }).click();
  await page.getByRole("button", { name: "Checklist ready" }).click();
  await expect(page.getByText("Your checklist is ready. Next you’ll set the amount and deadline for each post and invite Glow Theory.")).toBeVisible();
});
