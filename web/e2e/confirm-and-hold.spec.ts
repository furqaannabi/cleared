import { expect, test } from "./signed-in";

test("CH: brand asks → creator replies, changes and sends → brand agrees and holds → creator opens the draft check", async ({ page }) => {
  // The creator's side, waiting for the brand.
  await page.goto("/deals/deal_maple/invite");
  await page.getByRole("link", { name: "Open as Maple & Moss" }).click();

  // The brand asks for a change to the Reel's amount and sends it.
  await expect(page).toHaveURL(/\/brand\/deals\/deal_maple$/);
  await page.getByRole("button", { name: "Ask about the amount for the Instagram Reel" }).click();
  await page.getByRole("textbox", { name: "Your note about the amount for the Instagram Reel" }).fill("We said $400.");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByRole("button", { name: "Send 1 change to Ada Okafor" }).click();
  await expect(page.getByText(/^Sent to Ada Okafor\./)).toBeVisible();

  // The creator replies, changes the amount, connects Instagram and sends version 2.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Maple & Moss asked for 1 change" })).toBeVisible();
  await page.getByRole("button", { name: "Reply about the amount for the Instagram Reel" }).click();
  await page.getByRole("textbox", { name: "Your reply about the amount for the Instagram Reel" }).fill("Fixed, sorry!");
  await page.getByRole("button", { name: "Save reply" }).click();
  const amount = page.getByRole("textbox", { name: "Amount for the Instagram Reel", exact: true });
  await amount.fill("400");
  await amount.blur();
  await expect(amount).toHaveValue("400.00");
  await page.getByRole("button", { name: "Connect Instagram" }).click();
  await page.getByRole("button", { name: "Send updated terms to Maple & Moss" }).click();
  await expect(page.getByText("Version 2 sent")).toBeVisible();

  // The brand sees what changed and the reply, agrees, and approves every hold.
  await page.getByRole("link", { name: "Open as Maple & Moss" }).click();
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sponsorship terms" }).getByText("Amount changed")).toBeVisible();
  await expect(page.getByText("Fixed, sorry!")).toBeVisible();
  await page.getByRole("button", { name: "Agree to these terms" }).click();
  const holds = page.getByRole("region", { name: /^Holds/ });
  for (const name of ["YouTube video", "Instagram Reel", "YouTube Short"]) {
    const row = holds.getByRole("group", { name });
    await row.getByRole("button", { name: "Approve with PayPal" }).click();
    await row.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(row.getByText(/^Held · /)).toBeVisible();
  }
  await expect(holds.getByText("All held. Ada Okafor is making the posts.")).toBeVisible();

  // The creator sees each hold and opens the first post's draft check, which waits for the draft.
  await page.goBack();
  const sheet = page.getByRole("region", { name: "Sponsorship terms" });
  await expect(sheet.getByText("Maple & Moss agreed · 3 of 3 held")).toBeVisible();
  await sheet.getByRole("group", { name: "YouTube video" }).getByRole("link", { name: "Open draft check" }).click();
  await expect(page).toHaveURL(/\/deals\/deal_maple\/deliverables\/del_maple_video$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Maple & Moss");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("Mocks: the brand's notes survive a reload and a typed address, and Reset demo data puts the seed back", async ({ page }, testInfo) => {
  await page.goto("/b/demo_maple");
  await page.getByRole("button", { name: "Anything else about this deal?" }).click();
  await page.getByRole("textbox", { name: "Your note about this deal" }).fill("Could we add a Short?");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByRole("button", { name: "Send 1 change to Ada Okafor" }).click();
  await expect(page.getByText(/^Sent to Ada Okafor\./)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/^Sent to Ada Okafor\./)).toBeVisible();
  await page.goto("/deals/deal_maple/invite");
  await expect(page.getByRole("heading", { name: "Maple & Moss asked for 1 change" })).toBeVisible();

  if (testInfo.project.name === "desktop-1280") {
    await page.getByRole("button", { name: "Reset demo data" }).click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    // SI-FR-14: resetting also signs out; sign back in to the demo to see the seed.
    await page.waitForURL(/\/sign-in/);
    await page.goto("/sign-in?next=%2Fdeals%2Fdeal_maple%2Finvite");
    await page.getByRole("button", { name: "Try the demo account" }).click();
    await page.waitForURL(/\/deals\/deal_maple\/invite$/);
    await expect(page.getByText(/^Sent to Maple & Moss · waiting/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /asked for/ })).toHaveCount(0);
  }
});
