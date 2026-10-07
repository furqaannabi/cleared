import { shouldEnableMocking } from "./should-enable-mocking";

/**
 * Whether this build runs on mocks (development with
 * `NEXT_PUBLIC_API_MOCKING=enabled`). Never true in a production build.
 * Read literally so Next inlines both values.
 *
 * @see docs/decisions/2026-10-06-frontend-mocks-msw.md
 */
export const MOCKING_ENABLED = shouldEnableMocking({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_MOCKING: process.env.NEXT_PUBLIC_API_MOCKING,
});
