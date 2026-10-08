import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { setNextHoldOutcome } from "@/mocks/brand-deals";
import { setReadingSpeed } from "@/mocks/deal-drafts";

const tokenOf = (url: string) => url.split("/b/")[1];

describe("CH-FR-01 to CH-FR-03 opening the link", () => {
  test("the seeded demo link opens its deal, which the session can then read", async () => {
    const opened = await api.openBrandLink("demo_maple");
    expect(opened).toEqual({ ok: true, data: { dealId: "deal_maple" } });
    const deal = await api.getBrandDeal("deal_maple");
    expect(deal.ok && deal.data).toMatchObject({ creatorName: "Ada Okafor", brandName: "Maple & Moss", step: "waiting_for_brand", version: 1 });
  });

  test("a deal can't be read before its link is opened", async () => {
    expect(await api.getBrandDeal("deal_maple")).toEqual({ ok: false, error: "not_found" });
  });

  test("an unknown token and a turned-off link get the same answer", async () => {
    expect(await api.openBrandLink("nope")).toEqual({ ok: false, error: "not_found" });
    await api.turnOffInviteLink("deal_maple");
    expect(await api.openBrandLink("demo_maple")).toEqual({ ok: false, error: "not_found" });
  });

  test("a link the creator creates opens their deal, with its checklist, brief and answers", async () => {
    setReadingSpeed(0);
    const created = await api.createDeal({ brandName: "Fern Labs", deliverables: [{ platform: "youtube_video" }] });
    if (!created.ok) throw new Error(created.error);
    const id = created.data.id;
    await api.submitBrief(id, "Say and show the code FERN5.\nKeep it fun!");
    const read = await api.getDealDraft(id);
    for (const q of read.ok ? read.data.questions : []) await api.answerQuestion(id, q.id, { kind: "left_out" });
    await api.markChecklistReady(id);
    await api.updateInvitePost(id, created.data.deliverables[0].id, { amount: "800.00", deadlineDays: 9 });
    const invite = await api.createInviteLink(id);
    if (!invite.ok || !invite.data.link) throw new Error("no link");

    expect(await api.openBrandLink(tokenOf(invite.data.link.url))).toEqual({ ok: true, data: { dealId: id } });
    const deal = await api.getBrandDeal(id);
    if (!deal.ok) throw new Error(deal.error);
    expect(deal.data.posts).toEqual([{ deliverableId: created.data.deliverables[0].id, platform: "youtube_video", amount: "800.00", deadlineDays: 9, hold: { state: "not_started" } }]);
    expect(deal.data.items.length).toBeGreaterThan(0);
    expect(deal.data.brief.map((l) => l.text)).toEqual(["Say and show the code FERN5.", "Keep it fun!"]);
    expect(deal.data.answers).toEqual([{ briefLine: 2, kind: "left_out" }]);
  });

  test("CH-BR-08: the brand's deal never carries the creator's PayPal email", async () => {
    await api.openBrandLink("demo_maple");
    const deal = await api.getBrandDeal("deal_maple");
    expect(JSON.stringify(deal)).not.toContain("ada@example.com");
  });
});

describe("CH-FR-10 to CH-FR-12 sending changes", () => {
  test("sends the notes together; the deal moves to changes requested and keeps them on this version", async () => {
    await api.openBrandLink("demo_maple");
    const sent = await api.sendChanges("deal_maple", [
      { about: { kind: "item", itemId: "it_maple_link" }, text: "Please use maplemoss.com/ada-okafor." },
      { about: { kind: "deal" }, text: "We agreed four posts." },
    ]);
    expect(sent.ok && sent.data.step).toBe("changes_requested");
    expect(sent.ok && sent.data.notes.map((n) => [n.text, n.version])).toEqual([
      ["Please use maplemoss.com/ada-okafor.", 1],
      ["We agreed four posts.", 1],
    ]);
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.find((d) => d.id === "deal_maple")?.status).toBe("Changes asked");
  });

  test("refuses no notes, a note over 500 characters, and a note about something not on the deal", async () => {
    await api.openBrandLink("demo_maple");
    expect(await api.sendChanges("deal_maple", [])).toEqual({ ok: false, error: "rejected" });
    expect(await api.sendChanges("deal_maple", [{ about: { kind: "deal" }, text: "x".repeat(501) }])).toEqual({ ok: false, error: "rejected" });
    expect(await api.sendChanges("deal_maple", [{ about: { kind: "item", itemId: "nope" }, text: "Hm" }])).toEqual({ ok: false, error: "rejected" });
  });
});

describe("CH-FR-14 to CH-FR-16 agreeing", () => {
  test("agrees to the version shown; the deal is agreed with the date", async () => {
    await api.openBrandLink("demo_maple");
    const agreed = await api.agree("deal_maple", 1);
    expect(agreed.ok && agreed.data).toMatchObject({ step: "agreed", version: 1 });
    expect(agreed.ok && agreed.data.agreedAt).toBeTruthy();
  });

  test("CH-BR-02: refuses a version that isn't the current one, and agreeing twice", async () => {
    await api.openBrandLink("demo_maple");
    expect(await api.agree("deal_maple", 2)).toEqual({ ok: false, error: "rejected" });
    await api.agree("deal_maple", 1);
    expect(await api.agree("deal_maple", 1)).toEqual({ ok: false, error: "rejected" });
  });

  test("can't agree while the creator is answering changes", async () => {
    await api.openBrandLink("demo_maple");
    await api.sendChanges("deal_maple", [{ about: { kind: "deal" }, text: "One more post?" }]);
    expect(await api.agree("deal_maple", 1)).toEqual({ ok: false, error: "rejected" });
  });
});

describe("CH-FR-17, CH-FR-18, CH-BR-03 holds", () => {
  async function agreed() {
    await api.openBrandLink("demo_maple");
    await api.agree("deal_maple", 1);
  }
  const holdOf = (r: Awaited<ReturnType<typeof api.getBrandDeal>>, id: string) => (r.ok ? r.data.posts.find((p) => p.deliverableId === id)?.hold : undefined);

  test("no hold can start before the brand agrees", async () => {
    await api.openBrandLink("demo_maple");
    expect(await api.startHold("deal_maple", "del_maple_video")).toEqual({ ok: false, error: "rejected" });
  });

  test("an approved hold is held with a reference, and its deadline is fixed from today", async () => {
    await agreed();
    const started = await api.startHold("deal_maple", "del_maple_video");
    if (!started.ok) throw new Error(started.error);
    const r = await api.confirmHold("deal_maple", "del_maple_video", started.data.orderId);
    const hold = holdOf(r, "del_maple_video");
    expect(hold?.state).toBe("held");
    expect(hold?.reference).toMatch(/^DEMO-/);
    const expected = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    expect(hold?.deadline).toBe(expected);
    expect(holdOf(r, "del_maple_reel")).toEqual({ state: "not_started" });
  });

  test("each post is held on its own; a held post can't be approved again", async () => {
    await agreed();
    const s = await api.startHold("deal_maple", "del_maple_video");
    if (!s.ok) throw new Error(s.error);
    await api.confirmHold("deal_maple", "del_maple_video", s.data.orderId);
    expect(await api.startHold("deal_maple", "del_maple_video")).toEqual({ ok: false, error: "rejected" });
  });

  test("the demo PayPal's next answer decides the outcome: declined, pending or unknown", async () => {
    await agreed();
    for (const outcome of ["declined", "pending", "unknown"] as const) {
      setNextHoldOutcome(outcome);
      const s = await api.startHold("deal_maple", "del_maple_reel");
      if (!s.ok) throw new Error(`${outcome}: ${s.error}`);
      const r = await api.confirmHold("deal_maple", "del_maple_reel", s.data.orderId);
      expect(holdOf(r, "del_maple_reel")).toEqual({ state: outcome });
      if (outcome !== "declined") break;
    }
    // CH-BR-05: still waiting on PayPal, so no second approval.
    expect(await api.startHold("deal_maple", "del_maple_reel")).toEqual({ ok: false, error: "rejected" });
  });

  test("closing PayPal records that nothing was held, and the hold can start again", async () => {
    await agreed();
    const s = await api.startHold("deal_maple", "del_maple_short");
    if (!s.ok) throw new Error(s.error);
    const r = await api.cancelHold("deal_maple", "del_maple_short", s.data.orderId);
    expect(holdOf(r, "del_maple_short")).toEqual({ state: "closed" });
    expect((await api.startHold("deal_maple", "del_maple_short")).ok).toBe(true);
  });

  test("an order id from another post is refused", async () => {
    await agreed();
    const s = await api.startHold("deal_maple", "del_maple_video");
    if (!s.ok) throw new Error(s.error);
    expect(await api.confirmHold("deal_maple", "del_maple_reel", s.data.orderId)).toEqual({ ok: false, error: "rejected" });
  });
});
