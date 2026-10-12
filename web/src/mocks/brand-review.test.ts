import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { endReviewWindow } from "@/mocks/demo-review";

const DEAL = "deal_juniper";
const VIDEO = "del_juniper_video";
const REEL = "del_juniper_reel";
const SHORT = "del_juniper_short";

const open = () => api.openBrandLink("demo_juniper");
const read = async (id: string) => {
  const r = await api.getBrandDeliverable(DEAL, id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe("RW-FR-05 to RW-FR-10 the brand's review of one post", () => {
  test("the demo link opens a held deal; the video is in its review window with each item worded for the brand", async () => {
    expect(await open()).toEqual({ ok: true, data: { dealId: DEAL } });
    const video = await read(VIDEO);
    expect(video).toMatchObject({ creatorName: "Ada Okafor", brandName: "Juniper & Salt", platform: "youtube_video", review: { state: "window" } });
    expect(video.review.state === "window" && Date.parse(video.review.endsAt)).toBeGreaterThan(Date.now());
    expect(video.hold).toMatchObject({ amount: "1500.00", reference: "DEMO-JV7K2Q9P" });
    expect(video.draft?.items.map((i) => [i.id, i.status])).toEqual([
      ["jv_1", "passed"],
      ["jv_2", "accepted"],
      ["jv_3", "passed"],
      ["jv_4", "passed"],
      ["jv_5", "at_live_check"],
      ["jv_6", "at_live_check"],
    ]);
  });
});

describe("RW-BR-06 the brand sees the latest draft's facts only", () => {
  test("never a fix hint, an earlier status, the run number, the file name or the creator's PayPal email", async () => {
    await open();
    for (const id of [VIDEO, REEL, SHORT]) {
      const body = JSON.stringify(await read(id));
      for (const secret of ["fixHint", "Hold the shot", "previousStatus", "\"run\"", "tide_", "ada@example.com"]) expect(body, `${id}: ${secret}`).not.toContain(secret);
    }
  });

  test("RW-FR-06: the Reel shows its draft because Ada asked about an item; the Short is approved", async () => {
    await open();
    const reel = await read(REEL);
    expect(reel.review).toEqual({ state: "asked" });
    expect(reel.draft?.items.find((i) => i.id === "jr_1")?.status).toBe("asked");
    expect((await read(SHORT)).review).toMatchObject({ state: "approved", by: "brand" });
  });

  test("RW-FR-04, RW-FR-05: no session, or a post from another deal, gets the same not-found answer", async () => {
    expect(await api.getBrandDeliverable(DEAL, VIDEO)).toEqual({ ok: false, error: "not_found" });
    await open();
    expect(await api.getBrandDeliverable(DEAL, "del_glow_video")).toEqual({ ok: false, error: "not_found" });
  });
});

describe("RW-FR-12 to RW-FR-14 answering an ask", () => {
  test("accepting the last open item opens the 48-hour window; the creator sees Accepted by brand", async () => {
    await open();
    const r = await api.acceptItem(DEAL, REEL, "jr_1");
    if (!r.ok) throw new Error(r.error);
    expect(r.data.draft?.items.find((i) => i.id === "jr_1")?.status).toBe("accepted");
    expect(r.data.review.state).toBe("window");
    const ends = r.data.review.state === "window" ? Date.parse(r.data.review.endsAt) - Date.now() : 0;
    expect(Math.round(ends / 3_600_000)).toBe(48);
    const creator = await api.getDeliverable(REEL);
    expect(creator.ok && creator.data).toMatchObject({ state: "fully_passing" });
    expect(creator.ok && creator.data.items.find((i) => i.id === "jr_1")?.status).toBe("accepted_by_brand");
  });

  test("asking Ada to fix it, with an optional note: the creator sees it declined with the note", async () => {
    await open();
    const r = await api.askToFix(DEAL, REEL, "jr_1", "  Let the salts fully dissolve on camera.  ");
    if (!r.ok) throw new Error(r.error);
    expect(r.data.draft?.items.find((i) => i.id === "jr_1")).toMatchObject({ status: "fix_requested", note: "Let the salts fully dissolve on camera." });
    expect(r.data.review.state).toBe("asked");
    const creator = await api.getDeliverable(REEL);
    expect(creator.ok && creator.data.items.find((i) => i.id === "jr_1")).toMatchObject({ status: "unsure", declined: true, brandNote: "Let the salts fully dissolve on camera." });
    expect((await api.askToFix(DEAL, REEL, "jr_2")).ok).toBe(false);
  });

  test("an answer can't be changed, and only an item the creator asked about can be answered", async () => {
    await open();
    await api.acceptItem(DEAL, REEL, "jr_1");
    expect(await api.askToFix(DEAL, REEL, "jr_1")).toEqual({ ok: false, error: "rejected" });
    expect(await api.acceptItem(DEAL, VIDEO, "jv_1")).toEqual({ ok: false, error: "rejected" });
    expect(await api.askToFix(DEAL, REEL, "jr_2", "x".repeat(501))).toEqual({ ok: false, error: "rejected" });
  });
});

describe("RW-FR-16 to RW-FR-18, RW-FR-21 approving and objecting in the window", () => {
  test("objections, each on a passed item with a note, stop the clock; the creator sees each one with its note", async () => {
    await open();
    const r = await api.sendObjections(DEAL, VIDEO, [
      { itemId: "jv_3", note: " Say it slower. " },
      { itemId: "jv_4", note: "Hold the code on screen longer." },
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.review.state).toBe("objected");
    expect(r.data.draft?.items.filter((i) => i.status === "objected").map((i) => [i.id, i.note])).toEqual([
      ["jv_3", "Say it slower."],
      ["jv_4", "Hold the code on screen longer."],
    ]);
    const creator = await api.getDeliverable(VIDEO);
    expect(creator.ok && creator.data.state).toBe("objected");
    expect(creator.ok && creator.data.reviewWindowEndsAt).toBeUndefined();
    expect(creator.ok && creator.data.items.find((i) => i.id === "jv_3")).toMatchObject({ status: "objected_by_brand", brandNote: "Say it slower." });
  });

  test("RW-BR-02, RW-BR-03: refused without a note, on an accepted or At live check item, twice on one item, or with none", async () => {
    await open();
    for (const objections of [
      [{ itemId: "jv_3", note: "  " }],
      [{ itemId: "jv_2", note: "Accepted earlier." }],
      [{ itemId: "jv_5", note: "Checked after posting." }],
      [{ itemId: "jv_3", note: "One." }, { itemId: "jv_3", note: "Two." }],
      [{ itemId: "jv_3", note: "x".repeat(501) }],
      [],
    ]) {
      expect(await api.sendObjections(DEAL, VIDEO, objections), JSON.stringify(objections)).toEqual({ ok: false, error: "rejected" });
    }
  });

  test("RW-BR-04: objections are sent once per draft; afterwards only approving the draft anyway", async () => {
    await open();
    await api.sendObjections(DEAL, VIDEO, [{ itemId: "jv_3", note: "Say it slower." }]);
    expect((await api.sendObjections(DEAL, VIDEO, [{ itemId: "jv_4", note: "And this." }])).ok).toBe(false);
    const r = await api.approveDraft(DEAL, VIDEO);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.review).toMatchObject({ state: "approved", by: "brand" });
    expect(r.data.draft?.items.find((i) => i.id === "jv_3")).toMatchObject({ status: "passed" });
    expect(r.data.draft?.items.find((i) => i.id === "jv_3")?.note).toBeUndefined();
    const creator = await api.getDeliverable(VIDEO);
    expect(creator.ok && creator.data).toMatchObject({ state: "approved", approvedBy: "brand" });
  });

  test("RW-FR-16: approving in the window; then nothing more can be sent", async () => {
    await open();
    expect((await api.approveDraft(DEAL, VIDEO)).ok).toBe(true);
    expect((await api.approveDraft(DEAL, VIDEO)).ok).toBe(false);
    expect((await api.sendObjections(DEAL, VIDEO, [{ itemId: "jv_3", note: "Late." }])).ok).toBe(false);
  });

  test("approving or objecting is refused while the creator is still on the draft check", async () => {
    await open();
    expect((await api.approveDraft(DEAL, REEL)).ok).toBe(false);
    expect((await api.sendObjections(DEAL, REEL, [{ itemId: "jr_2", note: "No." }])).ok).toBe(false);
  });
});

describe("RW-FR-20, RW-BR-01 the window ends", () => {
  test("with no objection the draft is approved by the window, for both sides; a late objection is refused", async () => {
    await open();
    expect(await endReviewWindow(VIDEO)).toBe(true);
    expect((await read(VIDEO)).review).toMatchObject({ state: "approved", by: "window" });
    expect(await api.sendObjections(DEAL, VIDEO, [{ itemId: "jv_3", note: "Too late?" }])).toEqual({ ok: false, error: "rejected" });
    const creator = await api.getDeliverable(VIDEO);
    expect(creator.ok && creator.data).toMatchObject({ state: "approved", approvedBy: "window" });
  });

  test("nothing else clears on a timer: an item waiting for the brand stays waiting", async () => {
    await open();
    expect(await endReviewWindow(REEL)).toBe(false);
    expect((await read(REEL)).review.state).toBe("asked");
  });
});

describe("RW-FR-03, RW-FR-25 a fresh link while the brand has something to do", () => {
  const linkOf = async (id: string) => {
    const d = await api.getDeliverable(id);
    return d.ok ? d.data.reviewLink : undefined;
  };

  test("the creator gets a link for each post that waits on the brand, and none for an approved one", async () => {
    expect((await linkOf(VIDEO))?.url).toMatch(/^https:\/\/cleared\.example\/b\/\w+$/);
    expect(await linkOf(REEL)).toBeDefined();
    expect(await linkOf(SHORT)).toBeUndefined();
    expect(await linkOf("del_glow_video")).toBeUndefined();
  });

  test("opening it lands on that post; once the brand has answered, it stops working", async () => {
    const url = (await linkOf(VIDEO))!.url;
    const token = url.split("/b/")[1];
    expect(await api.openBrandLink(token)).toEqual({ ok: true, data: { dealId: DEAL, deliverableId: VIDEO } });
    await api.approveDraft(DEAL, VIDEO);
    expect(await api.openBrandLink(token)).toEqual({ ok: false, error: "not_found" });
    expect(await linkOf(VIDEO)).toBeUndefined();
  });
});

describe("RW-FR-01 each post's draft on the brand's deal page", () => {
  test("each held post says where its review stands, with counts for asks and objections", async () => {
    await open();
    await api.sendObjections(DEAL, VIDEO, [{ itemId: "jv_3", note: "Slower." }]);
    const deal = await api.getBrandDeal(DEAL);
    if (!deal.ok) throw new Error(deal.error);
    expect(Object.fromEntries(deal.data.posts.map((p) => [p.deliverableId, p.review]))).toEqual({
      [VIDEO]: { state: "objected", count: 1 },
      [REEL]: { state: "asked", count: 1 },
      [SHORT]: { state: "approved" },
    });
  });

  test("the window's end comes with the post", async () => {
    await open();
    const deal = await api.getBrandDeal(DEAL);
    const video = deal.ok ? deal.data.posts.find((p) => p.deliverableId === VIDEO) : undefined;
    expect(video?.review?.state).toBe("window");
    expect(video?.review?.state === "window" && Date.parse(video.review.endsAt)).toBeGreaterThan(Date.now());
  });

  test("a post with no draft check yet has no review line", async () => {
    await api.openBrandLink("demo_maple");
    const deal = await api.getBrandDeal("deal_maple");
    expect(deal.ok && deal.data.posts.every((p) => p.review === undefined)).toBe(true);
  });
});

describe("DC-FR-31, DC-FR-37 the creator's deals list once every post is held", () => {
  test("each post shows its own state; the deal opens the post that needs the creator", async () => {
    await open();
    await api.sendObjections(DEAL, VIDEO, [{ itemId: "jv_3", note: "Slower." }]);
    const deals = await api.getDeals();
    const juniper = deals.ok ? deals.data.find((d) => d.id === DEAL) : undefined;
    expect(juniper?.deliverables.map((x) => [x.id, x.state])).toEqual([
      [VIDEO, "objected"],
      [REEL, "results"],
      [SHORT, "approved"],
    ]);
    expect(juniper).toMatchObject({ openDeliverableId: VIDEO, status: "Juniper & Salt objected" });
  });

  test("PP-FR-24: an approved post needs the creator (the go-ahead), so the deal opens it", async () => {
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.find((d) => d.id === DEAL)).toMatchObject({ openDeliverableId: SHORT, status: "Ready to post" });
  });
});
