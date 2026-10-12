import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";

const creator = async (id: string) => {
  const r = await api.getDeliverable(id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe("CN-FR-03, CN-FR-10 the creator cancels a held post", () => {
  test("a held post can be cancelled; cancelling releases the hold to the brand, with who, when and the note", async () => {
    expect((await creator("del_kora_reel")).cancel).toEqual({ allowed: true });
    const r = await api.cancelDeliverable("del_kora_reel", "  The timing doesn’t work this month.  ");
    if (!r.ok) throw new Error(r.error);
    expect(r.data).toMatchObject({ state: "released", releaseReason: "cancelled", cancelled: { by: "creator", note: "The timing doesn’t work this month." }, cancel: { allowed: false, reason: "finished" } });
    expect(r.data.releasedAt).toBe(r.data.cancelled?.at);
    expect(await creator("del_kora_reel")).toMatchObject({ state: "released", cancelled: { by: "creator" } });
  });

  test("the note is optional, and refused over 300 characters", async () => {
    expect(await api.cancelDeliverable("del_kora_reel", "x".repeat(301))).toEqual({ ok: false, error: "rejected" });
    const r = await api.cancelDeliverable("del_kora_reel");
    expect(r.ok && r.data.cancelled).toMatchObject({ by: "creator" });
    expect(r.ok && r.data.cancelled?.note).toBeUndefined();
  });

  test("CN-FR-09: refused once cancelled, during a go-ahead, once published, and once paid; the post says why", async () => {
    await api.cancelDeliverable("del_kora_reel");
    expect(await api.cancelDeliverable("del_kora_reel")).toEqual({ ok: false, error: "rejected" });
    await api.getGoAhead("del_juniper_short");
    expect(await api.cancelDeliverable("del_juniper_short")).toEqual({ ok: false, error: "rejected" });
    expect((await creator("del_juniper_short")).cancel).toEqual({ allowed: false, reason: "go_ahead_running" });
    await api.markPosted("del_juniper_short");
    expect((await creator("del_juniper_short")).cancel).toEqual({ allowed: false, reason: "published" });
    expect((await creator("del_wren_video")).cancel).toEqual({ allowed: false, reason: "finished" });
  });
});

describe("CN-FR-01, CN-FR-10 the brand cancels a held post", () => {
  test("the brand's post says whether it can be cancelled; cancelling releases the hold, and the creator sees who and the note", async () => {
    await api.openBrandLink("demo_juniper");
    const before = await api.getBrandDeliverable("deal_juniper", "del_juniper_reel");
    expect(before.ok && before.data.cancel).toEqual({ allowed: true });
    const r = await api.cancelBrandDeliverable("deal_juniper", "del_juniper_reel", "We’re pausing the campaign.");
    if (!r.ok) throw new Error(r.error);
    expect(r.data).toMatchObject({ review: { state: "released", reason: "cancelled" }, cancelled: { by: "brand", note: "We’re pausing the campaign." }, cancel: { allowed: false, reason: "finished" } });
    expect(await creator("del_juniper_reel")).toMatchObject({ state: "released", cancelled: { by: "brand", note: "We’re pausing the campaign." } });
    expect(JSON.stringify(r.data)).not.toContain("ada@example.com");
  });

  test("refused without the deal's session, and during a go-ahead", async () => {
    expect((await api.cancelBrandDeliverable("deal_juniper", "del_juniper_reel")).ok).toBe(false);
    await api.openBrandLink("demo_juniper");
    await api.getGoAhead("del_juniper_short");
    expect(await api.cancelBrandDeliverable("deal_juniper", "del_juniper_short")).toEqual({ ok: false, error: "rejected" });
  });
});

describe("CN-FR-11, CN-FR-12, CN-FR-14, CN-FR-15 before the hold", () => {
  test("the creator cancels each post of an invite: closed, nothing held; the deal reads Cancelled", async () => {
    const before = await api.getInvite("deal_pine");
    expect(before.ok && before.data.posts.map((p) => p.cancel)).toEqual([{ allowed: true }, { allowed: true }]);
    const r = await api.cancelInvitePost("deal_pine", "del_pine_video", "Wrong brand, sorry.");
    expect(r.ok && r.data.posts[0]).toMatchObject({ cancel: { allowed: false, reason: "finished" }, cancelled: { by: "creator", note: "Wrong brand, sorry." } });
    expect(r.ok && r.data.posts[1].cancel).toEqual({ allowed: true });
    await api.cancelInvitePost("deal_pine", "del_pine_reel");
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.find((d) => d.id === "deal_pine")?.status).toBe("Cancelled");
  });

  test("the brand cancels before agreeing; its link then stops working, and the creator sees who and the note", async () => {
    await api.openBrandLink("demo_maple");
    for (const id of ["del_maple_video", "del_maple_reel", "del_maple_short"]) await api.cancelBrandDealPost("deal_maple", id, "We changed our plans.");
    const deal = await api.getBrandDeal("deal_maple");
    expect(deal.ok && deal.data.posts.every((p) => p.cancelled?.by === "brand")).toBe(true);
    const inv = await api.getInvite("deal_maple");
    expect(inv.ok && inv.data.posts[0].cancelled).toMatchObject({ by: "brand", note: "We changed our plans." });
    expect((await api.openBrandLink("demo_maple")).ok).toBe(false);
  });
});

describe("CN-FR-02 cancelling a held deal from its deal page", () => {
  test("held posts are released, a post with the go-ahead stays", async () => {
    await api.openBrandLink("demo_juniper");
    await api.getGoAhead("del_juniper_short");
    const video = await api.cancelBrandDealPost("deal_juniper", "del_juniper_video");
    expect(video.ok && video.data.posts.find((p) => p.deliverableId === "del_juniper_video")).toMatchObject({ cancelled: { by: "brand" }, review: { state: "released" } });
    expect((await api.cancelBrandDealPost("deal_juniper", "del_juniper_short")).ok).toBe(false);
    const inv = await api.getInvite("deal_juniper");
    expect(inv.ok && inv.data.posts.find((p) => p.deliverableId === "del_juniper_short")?.cancel).toEqual({ allowed: false, reason: "go_ahead_running" });
  });
});
