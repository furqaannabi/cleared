import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";

/** The demo deal after the brand sent two notes: one on an item, one on the Reel's amount. */
async function changesAsked() {
  await api.openBrandLink("demo_maple");
  await api.sendChanges("deal_maple", [
    { about: { kind: "item", itemId: "it_maple_link" }, text: "Use maplemoss.com/ada-okafor." },
    { about: { kind: "amount", deliverableId: "del_maple_reel" }, text: "We said $400." },
  ]);
}
const status = async (id: string) => {
  const r = await api.getDeals();
  return r.ok ? r.data.find((d) => d.id === id) : undefined;
};

describe("CH-FR-21, CH-FR-22 the creator sees the brand's notes", () => {
  test("the invite and the deal draft carry the notes; the rail says changes were asked", async () => {
    await changesAsked();
    const invite = await api.getInvite("deal_maple");
    expect(invite.ok && invite.data).toMatchObject({ step: "changes_requested", version: 1 });
    expect(invite.ok && invite.data.notes?.map((n) => n.text)).toEqual(["Use maplemoss.com/ada-okafor.", "We said $400."]);
    const draft = await api.getDealDraft("deal_maple");
    expect(draft.ok && draft.data.notes?.length).toBe(2);
    expect((await status("deal_maple"))?.status).toBe("Changes asked");
  });

  test("the terms can be changed again, and the brand's link stays on", async () => {
    await changesAsked();
    const saved = await api.updateInvitePost("deal_maple", "del_maple_reel", { amount: "400.00" });
    expect(saved.ok && saved.data.posts[1].amount).toBe("400.00");
    expect(saved.ok && saved.data.link?.expired).toBe(false);
  });

  test("going back to the checklist and marking it ready returns to changes asked, not a fresh invite", async () => {
    await changesAsked();
    expect((await api.reopenChecklist("deal_maple")).ok).toBe(true);
    const back = await api.markChecklistReady("deal_maple");
    expect(back.ok && back.data.step).toBe("changes_requested");
    const brand = await api.getBrandDeal("deal_maple");
    expect(brand.ok && brand.data.step).toBe("changes_requested");
  });
});

describe("CH-FR-23 replying to a note", () => {
  test("a reply is saved with the note; empty or over 500 characters is refused", async () => {
    await changesAsked();
    const invite = await api.getInvite("deal_maple");
    const id = invite.ok ? invite.data.notes![0].id : "";
    const r = await api.replyToNote("deal_maple", id, "Done.");
    expect(r.ok && r.data.notes?.[0].reply).toBe("Done.");
    expect(await api.replyToNote("deal_maple", id, " ")).toEqual({ ok: false, error: "rejected" });
    expect(await api.replyToNote("deal_maple", id, "x".repeat(501))).toEqual({ ok: false, error: "rejected" });
  });
});

describe("CH-FR-24 sending updated terms", () => {
  test("makes version 2 on the same link, marks what changed, and the brand sees it with the replies", async () => {
    await changesAsked();
    const invite = await api.getInvite("deal_maple");
    await api.replyToNote("deal_maple", invite.ok ? invite.data.notes![1].id : "", "Fixed.");
    await api.updateInvitePost("deal_maple", "del_maple_reel", { amount: "400.00" });
    await api.connectAccount("instagram");
    const sent = await api.sendUpdatedTerms("deal_maple");
    expect(sent.ok && sent.data).toMatchObject({ step: "waiting_for_brand", version: 2 });
    expect(sent.ok && sent.data.link?.url).toBe("https://cleared.example/b/demo_maple");

    const brand = await api.getBrandDeal("deal_maple");
    if (!brand.ok) throw new Error(brand.error);
    expect(brand.data).toMatchObject({ step: "waiting_for_brand", version: 2 });
    expect(brand.data.posts.find((p) => p.deliverableId === "del_maple_reel")).toMatchObject({ amount: "400.00", changed: ["amount"] });
    expect(brand.data.posts.find((p) => p.deliverableId === "del_maple_video")?.changed).toBeUndefined();
    expect(brand.data.notes[1]).toMatchObject({ text: "We said $400.", reply: "Fixed.", version: 1 });
    expect((await status("deal_maple"))?.status).toBe("Waiting for brand");
  });

  test("an item the creator renamed is marked changed", async () => {
    await changesAsked();
    await api.reopenChecklist("deal_maple");
    await api.renameItem("deal_maple", "it_maple_link", "maplemoss.com/ada-okafor in the description");
    await api.markChecklistReady("deal_maple");
    await api.connectAccount("instagram");
    await api.sendUpdatedTerms("deal_maple");
    const brand = await api.getBrandDeal("deal_maple");
    expect(brand.ok && brand.data.items.find((i) => i.id === "it_maple_link")).toMatchObject({ name: "maplemoss.com/ada-okafor in the description", changed: true });
  });

  test("is held back like Create link until every account is connected", async () => {
    await changesAsked();
    expect(await api.sendUpdatedTerms("deal_maple")).toEqual({ ok: false, error: "rejected" });
  });

  test("can only be sent while changes are asked", async () => {
    await api.connectAccount("instagram");
    expect(await api.sendUpdatedTerms("deal_maple")).toEqual({ ok: false, error: "rejected" });
  });
});

describe("CH-FR-21, CH-FR-25 holds, for the creator", () => {
  async function holdAll(ids: string[]) {
    for (const id of ids) {
      const s = await api.startHold("deal_maple", id);
      if (!s.ok) throw new Error(s.error);
      await api.confirmHold("deal_maple", id, s.data.orderId);
    }
  }

  test("agreed: the invite shows each post's hold, and the rail counts them", async () => {
    await api.openBrandLink("demo_maple");
    await api.agree("deal_maple", 1);
    await holdAll(["del_maple_video"]);
    const invite = await api.getInvite("deal_maple");
    expect(invite.ok && invite.data.posts.map((p) => p.hold?.state)).toEqual(["held", "not_started", "not_started"]);
    expect((await status("deal_maple"))?.status).toBe("Agreed · 1 of 3 held");
  });

  test("all held: the deal leaves set-up, opens a held post's draft check, which waits for the draft", async () => {
    await api.openBrandLink("demo_maple");
    await api.agree("deal_maple", 1);
    await holdAll(["del_maple_video", "del_maple_reel", "del_maple_short"]);
    const summary = await status("deal_maple");
    expect(summary).toMatchObject({ status: "Waiting for your draft", openDeliverableId: "del_maple_video" });
    expect(summary?.step).toBeUndefined();
    const d = await api.getDeliverable("del_maple_video");
    expect(d.ok && d.data).toMatchObject({ state: "no_draft", brandName: "Maple & Moss", hold: { amountMinor: 120000, stage: "held" } });
    expect(d.ok && d.data.items.length).toBe(5);
  });
});
