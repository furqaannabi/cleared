import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { api, apiBaseUrl } from "@/lib/api";
import { server } from "@/test/server";
import { apiError } from "@/test/stub-api";

const draft = `${apiBaseUrl}/deliverables/del_glow_video/draft`;
const file = () => new File([new Uint8Array(2048)], "cut 3.mp4", { type: "video/mp4" });

describe("DC-FR-45 (1.18) uploading a draft", () => {
  test("sends the file as the body with its name, and answers the run being checked", async () => {
    let seen: { name: string | null; type: string | null; bytes: number } | null = null;
    server.use(
      http.post(draft, async ({ request }) => {
        seen = { name: new URL(request.url).searchParams.get("fileName"), type: request.headers.get("content-type"), bytes: (await request.arrayBuffer()).byteLength };
        return HttpResponse.json({ deliverableId: "del_glow_video", state: "checking", run: 3 });
      }),
    );
    const progress: number[] = [];
    const r = await api.uploadDraft("del_glow_video", file(), { onProgress: (p) => progress.push(p) });
    expect(r).toEqual({ ok: true, data: { deliverableId: "del_glow_video", state: "checking", run: 3 } });
    expect(seen).toEqual({ name: "cut 3.mp4", type: "video/mp4", bytes: 2048 });
    expect(progress.at(-1)).toBe(100);
  });

  test("a post's first draft is taken: no run has finished yet, so the API answers run 0", async () => {
    server.use(http.post(draft, () => HttpResponse.json({ deliverableId: "del_glow_video", state: "checking", run: 0 })));
    expect(await api.uploadDraft("del_glow_video", file())).toEqual({ ok: true, data: { deliverableId: "del_glow_video", state: "checking", run: 0 } });
  });

  test("a file the API refuses keeps its code, with the length and the cap", async () => {
    server.use(http.post(draft, () => apiError({ code: "file_too_long", lengthSec: 1020, lengthCapSec: 900 }, 422)));
    expect(await api.uploadDraft("del_glow_video", file())).toEqual({ ok: false, error: "rejected", code: "file_too_long", file: { lengthSec: 1020, lengthCapSec: 900 } });
  });

  test("over the size limit, and each draft limit", async () => {
    server.use(http.post(draft, () => apiError({ code: "file_too_large" }, 413)));
    expect(await api.uploadDraft("del_glow_video", file())).toEqual({ ok: false, error: "rejected", code: "file_too_large" });
    server.use(http.post(draft, () => apiError({ code: "draft_limit", field: "overall", resetsAt: "2026-10-12T14:40:00.000Z" }, 429)));
    expect(await api.uploadDraft("del_glow_video", file())).toEqual({
      ok: false,
      error: "draft_limit",
      limit: { field: "overall", resetsAt: "2026-10-12T14:40:00.000Z" },
    });
    server.use(http.post(draft, () => apiError({ code: "draft_limit", field: "post" }, 429)));
    expect(await api.uploadDraft("del_glow_video", file())).toEqual({ ok: false, error: "draft_limit", limit: { field: "post" } });
  });

  test("Cancel stops it, and says so", async () => {
    server.use(http.post(draft, async () => new Promise(() => {})));
    const stop = new AbortController();
    const going = api.uploadDraft("del_glow_video", file(), { signal: stop.signal });
    stop.abort();
    expect(await going).toEqual({ ok: false, error: "cancelled" });
  });

  test("signed out, and an answer that breaks the contract", async () => {
    server.use(http.post(draft, () => apiError({ code: "signed_out" }, 401)));
    expect(await api.uploadDraft("del_glow_video", file())).toEqual({ ok: false, error: "signed_out" });
    server.use(http.post(draft, () => HttpResponse.json({ state: "done" })));
    expect(await api.uploadDraft("del_glow_video", file())).toEqual({ ok: false, error: "invalid_response" });
  });
});
