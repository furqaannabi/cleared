import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "@/mocks/node";
import { signInAs } from "@/mocks/session";
import { resetMockData } from "@/mocks/store";

// Any request without a handler fails the test, so no test reaches a real network.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));

afterEach(() => {
  cleanup();
  // DC-FR-36 keeps the selection in the URL; each test starts from a clean one.
  window.history.replaceState(null, "", "/");
  server.resetHandlers();
  resetMockData();
});

// SI-FR-14: tests run signed in as the demo account, except the sign-in tests, which sign out first.
beforeEach(() => signInAs("demo"));

afterAll(() => server.close());
