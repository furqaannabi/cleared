import { test as base, expect, type Page } from "@playwright/test";

/** The local backend the app on localhost:3000 talks to (ADR 2026-10-12, the live suite). */
export const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const SECRET = process.env.TEST_SESSION_SECRET;

/**
 * A test signed in as the backend's one test creator (AH-FR-27), through
 * `POST /test/session` with the secret, before the page opens. Skipped when
 * no secret is set, in CI too. The secret is only ever sent in the header;
 * it is never logged or written anywhere.
 */
export const test = base.extend<{ signedIn: void }>({
  signedIn: [
    async ({ context }, use) => {
      test.skip(!SECRET, "TEST_SESSION_SECRET is not set");
      const r = await context.request.post(`${API}/test/session`, { headers: { "X-Test-Secret": SECRET! } });
      expect(r.status(), "the test session (is the secret set on the backend too?)").toBe(200);
      await use();
    },
    { auto: true },
  ],
});
export { expect, type Page };

/** No page scrolls sideways (CLAUDE.md, mobile-first). */
export const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

/** Opens the creator's Deals sheet on phones, where the rail's links live. */
export async function openNav(page: Page) {
  if ((page.viewportSize()?.width ?? 0) < 1024) await page.getByRole("button", { name: "Deals" }).click();
}
