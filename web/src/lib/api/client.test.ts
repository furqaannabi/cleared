import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { server } from "@/mocks/node";
import { createApiClient } from "./client";

const BASE = "https://api.cleared.test";
const api = createApiClient({ baseUrl: BASE });

// Synthetic, in the provisional FRD shape.
const VALID = {
  id: "del_1",
  brandName: "Glow Theory",
  state: "results",
  deadline: "2026-10-24T23:59:00Z",
  hold: { amountMinor: 120000, currency: "USD" },
  items: [
    { id: "it_5", name: "Code GLOW20 shown on screen", status: "fix_needed" },
    { id: "it_4", name: "Says discount code GLOW20", status: "passed", previousStatus: "fix_needed" },
  ],
};

const respondWith = (body: unknown, init?: ResponseInit) =>
  server.use(http.get(`${BASE}/deliverables/:id`, () => HttpResponse.json(body as object, init)));

describe("DC-FR-01 getDeliverable", () => {
  test("returns the deliverable when the response is valid", async () => {
    respondWith(VALID);
    const result = await api.getDeliverable("del_1");
    expect(result).toEqual({ ok: true, data: VALID });
  });

  test("DC-FR-38: missing and not-yours look the same", async () => {
    respondWith({ message: "no" }, { status: 404 });
    expect(await api.getDeliverable("del_x")).toEqual({ ok: false, error: "not_found" });
    respondWith({ message: "no" }, { status: 403 });
    expect(await api.getDeliverable("del_x")).toEqual({ ok: false, error: "not_found" });
  });

  test("rejects a response that breaks the schema, never showing part of it", async () => {
    const broken = [
      { ...VALID, hold: { amountMinor: 1200.5, currency: "USD" } }, // money must be whole minor units
      { ...VALID, state: "approved" }, // not one of the six states
      { ...VALID, items: [{ id: "it_1", name: "x", status: "probably_fine" }] }, // unknown status
      { ...VALID, deadline: "next Friday" },
    ];
    for (const body of broken) {
      respondWith(body);
      expect(await api.getDeliverable("del_1")).toEqual({ ok: false, error: "invalid_response" });
    }
  });

  test("DC-FR-39: a server error or a network failure is unavailable, so the page offers Try again", async () => {
    respondWith({ message: "oops" }, { status: 500 });
    expect(await api.getDeliverable("del_1")).toEqual({ ok: false, error: "unavailable" });
    server.use(http.get(`${BASE}/deliverables/:id`, () => HttpResponse.error()));
    expect(await api.getDeliverable("del_1")).toEqual({ ok: false, error: "unavailable" });
    server.use(http.get(`${BASE}/deliverables/:id`, () => new HttpResponse("<html>", { status: 200 })));
    expect(await api.getDeliverable("del_1")).toEqual({ ok: false, error: "invalid_response" });
  });

  test("sends the session cookie, so the API can check the caller is a party to the deal", async () => {
    // MSW's Node interceptor drops RequestInit.credentials (diagnosed: a plain Request keeps
    // "include", the handler sees "same-origin"), so assert at the fetch boundary instead.
    respondWith(VALID);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await api.getDeliverable("del_1");
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ credentials: "include" });
    fetchSpy.mockRestore();
  });
});
