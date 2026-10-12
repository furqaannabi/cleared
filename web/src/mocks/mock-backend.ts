import { afterEach, beforeEach } from "vitest";
import { server } from "@/test/server";
import { handlers } from "./handlers";
import { resetMockData } from "./store";

/**
 * For the mocks' own tests: answers every request with the shared mock
 * backend that Playwright still runs on, from fresh data each test. Page and
 * component tests stub their own requests instead
 * (docs/decisions/2026-10-12-vitest-leaves-the-shared-mocks-before-playwright.md).
 */
export function runOnMockBackend() {
  beforeEach(() => server.use(...handlers));
  afterEach(() => resetMockData());
}
