import { expect, test } from "./signed-in";

const cursor = (el: Element) => getComputedStyle(el).cursor;

test("DESIGN.md: active controls show a pointer; disabled ones don't", async ({ page }) => {
  await page.goto("/deals/new");
  await page.getByLabel("Brand", { exact: true }).fill("Glow Theory");
  expect(await page.getByRole("button", { name: "Add another post" }).evaluate(cursor)).toBe("pointer");
  expect(await page.getByRole("button", { name: "Continue" }).evaluate(cursor)).toBe("pointer");
  expect(await page.getByLabel("Post 1", { exact: true }).evaluate(cursor)).toBe("pointer");

  await page.goto("/deals/deal_pine");
  const create = page.getByRole("button", { name: "Create link for Pine & Co" });
  await expect(create).toHaveAttribute("aria-disabled", "true");
  expect(await create.evaluate(cursor)).toBe("not-allowed");
  const fewer = page.getByRole("button", { name: "One day fewer for the YouTube video" });
  await expect(fewer).toBeDisabled();
  expect(await fewer.evaluate(cursor)).toBe("not-allowed");
  expect(await page.getByRole("button", { name: "One day more for the YouTube video" }).evaluate(cursor)).toBe("pointer");
});
