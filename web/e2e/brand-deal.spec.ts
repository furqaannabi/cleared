import { expect, test } from "./signed-in";

test("CH-FR-01 to CH-FR-09: the brand opens the demo link and reads the terms and where each item came from", async ({ page }) => {
  await page.goto("/b/demo_maple");
  await expect(page).toHaveURL(/\/brand\/deals\/deal_maple$/);
  expect(page.url()).not.toContain("demo_maple");

  await expect(page.getByRole("heading", { level: 1, name: "Your deal with Ada Okafor" })).toBeVisible();
  await expect(page.getByText("Ada Okafor invited Maple & Moss")).toBeVisible();
  const sheet = page.getByRole("region", { name: "Sponsorship terms" });
  await expect(sheet.getByText("$1,950.00")).toBeVisible();
  await expect(sheet.getByText(/read it as/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Not on the checklist" })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(await page.content()).not.toContain("ada@example.com");
});

test("CH-FR-02: a link that doesn't work says one thing", async ({ page }) => {
  await page.goto("/b/not-a-real-token");
  await expect(page.getByRole("heading", { name: "This link doesn’t work any more" })).toBeVisible();
  await expect(page.getByText("Ask the creator who sent it for a new one.")).toBeVisible();
});

test("CH-FR-10 to CH-FR-12: the brand asks for a change and sends it", async ({ page }) => {
  await page.goto("/b/demo_maple");
  await page.getByRole("button", { name: "Ask about the amount for the YouTube video" }).click();
  await page.getByRole("textbox", { name: "Your note about the amount for the YouTube video" }).fill("We said $1,100.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("button", { name: "Agree without sending your 1 note?" })).toBeVisible();
  await page.getByRole("button", { name: "Send 1 change to Ada Okafor" }).click();
  await expect(page.getByText("Sent to Ada Okafor. When they update the terms, this page shows the new version. You can close it.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Agree/ })).toHaveCount(0);
});

test("CH-FR-14 to CH-FR-16: the brand agrees to the terms", async ({ page }) => {
  await page.goto("/b/demo_maple");
  await page.getByRole("button", { name: "Agree to these terms" }).click();
  await expect(page.getByText(/^Agreed · version 1 · /)).toBeVisible();
  await expect(page.getByRole("button", { name: /Ask/ })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("CH-FR-17 to CH-FR-19: after agreeing, the brand approves each hold with the demo PayPal", async ({ page }) => {
  await page.goto("/b/demo_maple");
  await page.getByRole("button", { name: "Agree to these terms" }).click();
  const holds = page.getByRole("region", { name: /^Holds/ });
  await expect(holds.getByRole("heading", { name: "Holds · 0 of 3 held" })).toBeVisible();

  const reel = holds.getByRole("group", { name: "Instagram Reel" });
  await reel.getByRole("button", { name: "Approve with PayPal" }).click();
  await reel.getByRole("button", { name: "Approve, but the card is declined" }).click();
  await expect(reel.getByText(/^PayPal didn’t approve this hold/)).toBeVisible();

  for (const name of ["YouTube video", "Instagram Reel", "YouTube Short"]) {
    const row = holds.getByRole("group", { name });
    await row.getByRole("button", { name: "Approve with PayPal" }).click();
    await row.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(row.getByText(/^Held · /)).toBeVisible();
  }
  await expect(holds.getByText("All held. Ada Okafor is making the posts.")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
