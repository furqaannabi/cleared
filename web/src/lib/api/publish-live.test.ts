import { describe, expect, test } from "vitest";
import { http } from "msw";
import { api, apiBaseUrl } from "@/lib/api";
import { server } from "@/test/server";
import { aCreatorPost, apiError, stubCreatorPost, type CreatorPost } from "@/test/stub-api";

/* PP 1.3: the creator's post past Approved, as the contract answers it. */

const later: [string, Partial<CreatorPost>][] = [
  ["the go-ahead being confirmed with PayPal (PP-FR-01)", { goAhead: { state: "confirming" } }],
  ["a channel to reconnect (PP-FR-38)", { state: "published", post: { url: "https://www.youtube.com/watch?v=abc", publishedAt: "2026-10-11T10:00:00.000Z" }, liveCheck: { state: "reconnect_youtube" } }],
  ["a video not found (PP-FR-38)", { state: "published", liveCheck: { state: "video_not_found" } }],
  ["approved by the brand's silence (PP-FR-39)", { state: "published", liveCheck: { state: "approved", by: "brand_silence" } }],
  ["a check again in flight (PP-FR-12)", { state: "published", liveCheck: { state: "fixable", fixBy: "2026-10-13T10:00:00.000Z", checking: true } }],
  ["couldn't decide, as codes (PP-FR-14)", { state: "published", liveCheck: { state: "undecided", what: ["file_record", "paid_promotion"], brandBy: "2026-10-13T10:00:00.000Z" } }],
  ["not fixable, as a code (PP-FR-13)", { state: "published", liveCheck: { state: "not_fixable", reason: "not_your_channel", brandBy: "2026-10-13T10:00:00.000Z" } }],
  ["a refused capture (PP-FR-21)", { state: "published", liveCheck: { state: "passed" }, capture: { refused: true, retryUntil: "2026-10-30T10:00:00.000Z" } }],
  ["a returned payout (PP-FR-20)", { state: "captured", payout: { state: "failed", email: "ada@example.com", reason: "returned", canSendAgain: true } }],
];

describe("PP 1.3 the contract's later states are read", () => {
  test.each(later)("%s", async (_, fields) => {
    stubCreatorPost(aCreatorPost(fields));
    const r = await api.getDeliverable("del_glow_video");
    expect(r.ok).toBe(true);
  });
});

describe("PP-FR-37 (1.3) a 503 keeps its code", () => {
  test("YouTube not answering is told apart from a network failure", async () => {
    server.use(http.post(`${apiBaseUrl}/deliverables/del_glow_video/posted`, () => apiError({ code: "youtube_unavailable" }, 503)));
    expect(await api.markPosted("del_glow_video")).toEqual({ ok: false, error: "unavailable", code: "youtube_unavailable" });
  });
});
