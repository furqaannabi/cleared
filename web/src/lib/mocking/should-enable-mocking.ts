/** The build-time values that decide whether mocks run. */
export interface MockingEnv {
  NODE_ENV?: string;
  NEXT_PUBLIC_API_MOCKING?: string;
}

/**
 * Whether the browser should start the MSW worker. Only in development, and
 * only when `NEXT_PUBLIC_API_MOCKING` is exactly "enabled". A production build
 * never mocks, whatever the flag says.
 *
 * @param env - the build mode and mocking flag (normally `process.env`)
 * @returns true if mocks should run
 * @see docs/decisions/2026-10-06-frontend-mocks-msw.md
 */
export function shouldEnableMocking(env: MockingEnv): boolean {
  return env.NODE_ENV === "development" && env.NEXT_PUBLIC_API_MOCKING === "enabled";
}
