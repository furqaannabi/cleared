import { setupServer } from "msw/node";

/**
 * The MSW server every Vitest test stubs its own requests on, with no
 * handlers of its own: a request the test didn't stub fails the test (setup).
 * The mocks' own tests turn the shared mock backend on with
 * `runOnMockBackend()` (docs/decisions/2026-10-12-vitest-leaves-the-shared-mocks-before-playwright.md).
 */
export const server = setupServer();
