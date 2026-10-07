import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/mocks/node";
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

afterAll(() => server.close());
