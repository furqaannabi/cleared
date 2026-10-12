import { expect, noSidewaysScroll, test } from "./live";

const BRIEF = [
  "Thanks for partnering with Glow Theory on the Dew Drop serum launch!",
  "In the YouTube video, say “Glow Theory” in the first 60 seconds.",
  "Say and show the code GLOW20.",
  "Mark the post as a paid promotion.",
].join("\n");

/*
 * The live deal: new deal → brief (one real read by Claude) → checklist ready → invite.
 * The test creator has no YouTube connected (AH-FR-28), so the link is held back there
 * (ADR 2026-10-12, the suite stops at the invite).
 */
test("BC, IN: new deal → brief → checklist ready → invite, with the link held back until YouTube is connected", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/deals/new");
  await page.getByLabel("Brand", { exact: true }).fill("Glow Theory");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/deals\/[^/]+\/checklist$/);

  await page.getByLabel("Paste the brief Glow Theory sent").fill(BRIEF);
  await page.getByRole("button", { name: "Make the checklist" }).click();
  await expect(page.getByRole("region", { name: "Reading your brief" })).toBeVisible();
  // The model decides how many questions it asks: leave each out.
  const ready = page.getByRole("button", { name: "Checklist ready" });
  await expect(ready).toBeVisible({ timeout: 90_000 });
  for (let i = 0; i < 10 && (await ready.getAttribute("aria-disabled")) === "true"; i++) {
    await page.getByRole("button", { name: "Leave it out" }).first().click();
    await page.waitForTimeout(500);
  }
  await noSidewaysScroll(page);
  await ready.click();
  await page.getByRole("link", { name: "Set amounts and invite Glow Theory" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Glow Theory · Invite" })).toBeVisible();
  await page.getByRole("textbox", { name: "Amount for the YouTube video" }).fill("1200");
  await page.getByRole("spinbutton", { name: "Days after the hold for the YouTube video" }).fill("14");
  await page.keyboard.press("Tab");
  const paypal = page.getByRole("textbox", { name: "Your PayPal email" });
  if (!(await paypal.inputValue())) {
    await paypal.fill("ada@example.com");
    await page.keyboard.press("Tab");
  }
  const create = page.getByRole("button", { name: "Create link for Glow Theory" });
  await expect(create).toHaveAttribute("aria-disabled", "true");
  expect(await create.evaluate((el) => getComputedStyle(el).cursor)).toBe("not-allowed");
  await expect(page.getByRole("link", { name: "Connect YouTube" }).first()).toBeVisible();
  await noSidewaysScroll(page);
});
