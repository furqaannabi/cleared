import { expect, test } from "./signed-in";

test("DC-FR-33: switching posts keeps the tabs on screen and the pill glides to the new tab", async ({ page }) => {
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_video");
  const tabs = page.getByRole("navigation", { name: "Deliverables in this deal" });
  const pill = tabs.locator("[data-tab-pill]");
  await expect(pill).toBeVisible();
  const from = (await tabs.getByRole("link", { name: /YouTube video/ }).boundingBox())!;
  const to = (await tabs.getByRole("link", { name: /Instagram Reel/ }).boundingBox())!;
  // Every frame for a second: where the pill is, and whether the loading shape or a missing tab row ever shows.
  const frames = page.evaluate(
    () =>
      new Promise<{ x: number | null; loading: boolean }[]>((done) => {
        const seen: { x: number | null; loading: boolean }[] = [];
        const start = performance.now();
        const tick = () => {
          const p = document.querySelector("[data-tab-pill]");
          seen.push({ x: p ? p.getBoundingClientRect().x : null, loading: document.body.textContent!.includes("Loading this deliverable") });
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else done(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  await tabs.getByRole("link", { name: /Instagram Reel/ }).click();
  const seen = await frames;
  expect(seen.some((f) => f.loading)).toBe(false);
  expect(seen.every((f) => f.x !== null)).toBe(true);
  expect(seen.some((f) => f.x! > from.x + 2 && f.x! < to.x - 2)).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Juniper & Salt · Instagram Reel" })).toBeVisible();
  await expect.poll(async () => Math.round((await pill.boundingBox())!.x)).toBe(Math.round(to.x));
});

test("DC-FR-33: with reduced motion the pill moves without gliding", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/deals/deal_juniper/deliverables/del_juniper_video");
  const tabs = page.getByRole("navigation", { name: "Deliverables in this deal" });
  const to = (await tabs.getByRole("link", { name: /Instagram Reel/ }).boundingBox())!;
  await tabs.getByRole("link", { name: /Instagram Reel/ }).click();
  await expect(tabs.getByRole("link", { name: /Instagram Reel/ })).toHaveAttribute("aria-current", "page");
  await expect.poll(async () => Math.round((await tabs.locator("[data-tab-pill]").boundingBox())?.x ?? -1)).toBe(Math.round(to.x));
});
