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
  platform: "youtube_video",
  state: "results",
  deadline: "2026-10-24T23:59:00Z",
  creatorTimeZone: "UTC",
  hold: { amountMinor: 120000, currency: "USD", reference: "7HK21934LM", heldAt: "2026-10-03T10:00:00Z", stage: "held" },
  payoutEmail: "ada.okafor@example.com",
  items: [
    { id: "it_5", name: "Code GLOW20 shown on screen", kind: "shown_as_text", status: "fix_needed", briefLine: { number: 5, text: "Say and show the code GLOW20." }, checkedBy: "exact_match" },
    { id: "it_4", name: "Says discount code GLOW20", kind: "said", status: "passed", previousStatus: "fix_needed", briefLine: { number: 5, text: "Say and show the code GLOW20." }, checkedBy: "exact_match" },
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
      { ...VALID, hold: { ...VALID.hold, amountMinor: 1200.5 } }, // money must be whole minor units
      { ...VALID, state: "approved" }, // not one of the six states
      { ...VALID, items: [{ ...VALID.items[0], status: "probably_fine" }] }, // unknown status
      { ...VALID, deadline: "next Friday" },
      { ...VALID, creatorTimeZone: "Mars/Olympus_Mons" }, // DC-FR-44: must be a real timezone
      // DC-FR-23: a video source must be https or same-origin, never javascript:, http: or another host
      { ...VALID, draft: { fileName: "d.mp4", durationSec: 10, url: "javascript:alert(1)", urlExpiresAt: "2099-01-01T00:00:00Z" } },
      { ...VALID, draft: { fileName: "d.mp4", durationSec: 10, url: "http://evil.test/d.mp4", urlExpiresAt: "2099-01-01T00:00:00Z" } },
      { ...VALID, draft: { fileName: "d.mp4", durationSec: 10, url: "//evil.test/d.mp4", urlExpiresAt: "2099-01-01T00:00:00Z" } },
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

describe("DC-FR-14, DC-FR-15 asking the brand to accept an item", () => {
  const askPath = `${BASE}/deliverables/:deliverableId/items/:itemId/ask`;

  test("asking sends POST to the item's ask path and returns the updated deliverable", async () => {
    let seen = "";
    server.use(
      http.post(askPath, ({ request, params }) => {
        seen = `${request.method} ${params.deliverableId}/${params.itemId}`;
        return HttpResponse.json(VALID);
      }),
    );
    expect(await api.askBrandToAccept("del_1", "it_6")).toEqual({ ok: true, data: VALID });
    expect(seen).toBe("POST del_1/it_6");
  });

  test("withdrawing sends DELETE to the same path", async () => {
    let method = "";
    server.use(
      http.delete(askPath, ({ request }) => {
        method = request.method;
        return HttpResponse.json(VALID);
      }),
    );
    expect(await api.withdrawAsk("del_1", "it_6")).toEqual({ ok: true, data: VALID });
    expect(method).toBe("DELETE");
  });

  test("an ask the API refuses (the item changed, say) is rejected, not unavailable", async () => {
    server.use(http.post(askPath, () => HttpResponse.json({ message: "Item is not unsure" }, { status: 409 })));
    expect(await api.askBrandToAccept("del_1", "it_5")).toEqual({ ok: false, error: "rejected" });
  });
});

describe("DC-FR-26 refreshing the draft link", () => {
  test("asks for a fresh link with POST and returns the draft", async () => {
    const fresh = { fileName: "draft_v2.mp4", durationSec: 408, url: "https://media.test/d.mp4?sig=new", urlExpiresAt: "2099-01-01T00:00:00Z" };
    let method = "";
    server.use(
      http.post(`${BASE}/deliverables/:id/draft-url`, ({ request }) => {
        method = request.method;
        return HttpResponse.json(fresh);
      }),
    );
    expect(await api.refreshDraftUrl("del_1")).toEqual({ ok: true, data: fresh });
    expect(method).toBe("POST");
  });
});

describe("DC-FR-09 retrying a check that failed on our side", () => {
  test("posts to the retry path and returns the updated deliverable", async () => {
    let method = "";
    server.use(
      http.post(`${BASE}/deliverables/:id/check/retry`, ({ request }) => {
        method = request.method;
        return HttpResponse.json({ ...VALID, state: "checking" });
      }),
    );
    expect(await api.retryCheck("del_1")).toEqual({ ok: true, data: { ...VALID, state: "checking" } });
    expect(method).toBe("POST");
  });
});

describe("DC-FR-31, DC-FR-37 the creator's deals", () => {
  const DEALS = [
    { id: "deal_glow", brandName: "Glow Theory", status: "Draft check", openDeliverableId: "del_glow_video", deliverables: [] },
    { id: "deal_nb", brandName: "Northbound Coffee", status: "Brand review · 31h left", openDeliverableId: "del_nb_short", deliverables: [] },
  ];

  test("lists the deals with what to open for each", async () => {
    server.use(http.get(`${BASE}/deals`, () => HttpResponse.json(DEALS)));
    expect(await api.getDeals()).toEqual({ ok: true, data: DEALS });
  });

  test("rejects a deals list that breaks the schema", async () => {
    server.use(http.get(`${BASE}/deals`, () => HttpResponse.json([{ id: "deal_x" }])));
    expect(await api.getDeals()).toEqual({ ok: false, error: "invalid_response" });
  });
});
