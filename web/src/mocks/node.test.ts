import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { server } from "./node";

// Tooling check: the shared MSW server answers handled requests and rejects the rest.
const TEST_URL = "https://msw-check.test/ping";

test("a handled request gets the mocked response", async () => {
  server.use(http.get(TEST_URL, () => HttpResponse.json({ ok: true })));
  const res = await fetch(TEST_URL);
  expect(await res.json()).toEqual({ ok: true });
});

test("an unhandled request fails instead of reaching the network", async () => {
  await expect(fetch("https://msw-check.test/unhandled")).rejects.toThrow();
});
