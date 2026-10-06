import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// End-to-end tests. Every flow runs on a 375px phone and on desktop
// (CLAUDE.md: test every new component at 375px).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
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
    // Until the backend exists, e2e runs on the dev server with MSW mocks on, in CI too:
    // a production build never mocks (docs/decisions/2026-10-06-frontend-mocks-msw.md).
    command: `pnpm dev -p ${PORT}`,
    env: { NEXT_PUBLIC_API_MOCKING: "enabled" },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
