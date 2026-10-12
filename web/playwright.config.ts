import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The live suite runs against the developer's local backend (ADR 2026-10-12, stops at the invite).
// The test secret and the API's address come from web/.env.local, which git ignores; nothing is printed.
try {
  for (const line of readFileSync(join(__dirname, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*(TEST_SESSION_SECRET|NEXT_PUBLIC_API_BASE_URL)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // No .env.local: the signed-in specs skip themselves.
}

// The local backend answers only its APP_ORIGIN, the dev server on :3000.
const PORT = 3000;

// Every flow runs on a 375px phone and on desktop (CLAUDE.md: test every new component at 375px).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // In CI: annotations on the run, plus an HTML report that is kept when a test fails.
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "phone-375",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
    {
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    // Reuses the developer's running dev server; starts one when there is none.
    command: `pnpm dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
