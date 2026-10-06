import { describe, expect, test } from "vitest";
import { shouldEnableMocking } from "./should-enable-mocking";

// docs/decisions/2026-10-06-frontend-mocks-msw.md: MSW is never enabled in a production build.
describe("shouldEnableMocking", () => {
  test("is on in development when mocking is enabled", () => {
    expect(shouldEnableMocking({ NODE_ENV: "development", NEXT_PUBLIC_API_MOCKING: "enabled" })).toBe(true);
  });

  test("is off in development when mocking is not enabled", () => {
    expect(shouldEnableMocking({ NODE_ENV: "development" })).toBe(false);
    expect(shouldEnableMocking({ NODE_ENV: "development", NEXT_PUBLIC_API_MOCKING: "true" })).toBe(false);
  });

  test("is never on in a production build, even if enabled", () => {
    expect(shouldEnableMocking({ NODE_ENV: "production", NEXT_PUBLIC_API_MOCKING: "enabled" })).toBe(false);
  });

  test("is off when the build mode is unknown", () => {
    expect(shouldEnableMocking({ NEXT_PUBLIC_API_MOCKING: "enabled" })).toBe(false);
  });
});
