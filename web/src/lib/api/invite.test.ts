import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { setReadingSpeed } from "@/mocks/deal-drafts";

const BRIEF = ["In the YouTube video, say “Glow Theory” in the first 60 seconds.", "Say and show the code GLOW20.", "Mark the post as a paid promotion."].join("\n");

/** A deal whose checklist is ready: at the invite step. */
async function readyDeal() {
  setReadingSpeed(0);
  const created = await api.createDeal({ brandName: "Glow Theory", deliverables: [{ platform: "youtube_video" }, { platform: "instagram_reel" }] });
  if (!created.ok) throw new Error(created.error);
  await api.submitBrief(created.data.id, BRIEF);
  await api.getDealDraft(created.data.id);
  const ready = await api.markChecklistReady(created.data.id);
  if (!ready.ok) throw new Error(ready.error);
  return ready.data;
}

async function fillTerms(dealId: string, deliverableIds: string[]) {
  await api.updateInvitePost(dealId, deliverableIds[0], { amount: "1200.00", deadlineDays: 14 });
  await api.updateInvitePost(dealId, deliverableIds[1], { amount: "450.00", deadlineDays: 10 });
  await api.connectAccount("instagram");
}

describe("IN-FR-04, IN-FR-15 the invite terms", () => {
  test("a ready deal has one post per deliverable with its checklist count, and saves amounts and deadlines", async () => {
    const d = await readyDeal();
    const r = await api.getInvite(d.id);
    expect(r.ok && r.data).toMatchObject({ brandName: "Glow Theory", step: "invite" });
    expect(r.ok && r.data.posts.map((p) => [p.platform, p.itemCount > 0, p.amount])).toEqual([
      ["youtube_video", true, undefined],
      ["instagram_reel", true, undefined],
    ]);
    const saved = await api.updateInvitePost(d.id, d.deliverables[0].id, { amount: "1200.00", deadlineDays: 14 });
    expect(saved.ok && saved.data.posts[0]).toMatchObject({ amount: "1200.00", deadlineDays: 14 });
  });

  test("refuses a deadline outside 1 to 21 days, and an amount that isn't a two-place decimal string", async () => {
    const d = await readyDeal();
    expect(await api.updateInvitePost(d.id, d.deliverables[0].id, { deadlineDays: 22 })).toEqual({ ok: false, error: "rejected" });
    expect(await api.updateInvitePost(d.id, d.deliverables[0].id, { amount: "12.5" })).toEqual({ ok: false, error: "rejected" });
  });
});

describe("IN-FR-10, IN-FR-11, IN-FR-12 the creator's profile", () => {
  test("the demo creator has YouTube connected and a PayPal email; connecting Instagram adds it", async () => {
    const before = await api.getProfile();
    expect(before.ok && before.data).toMatchObject({ name: "Ada Okafor", paypalEmail: "ada@example.com", accounts: [{ platform: "youtube" }] });
    const after = await api.connectAccount("instagram");
    expect(after.ok && after.data.accounts.map((a) => a.platform)).toEqual(["youtube", "instagram"]);
    const email = await api.setPaypalEmail("ada.okafor@example.com");
    expect(email.ok && email.data.paypalEmail).toBe("ada.okafor@example.com");
  });
});

describe("IN-FR-16 to IN-FR-19 the link", () => {
  test("creating the link needs every term; it locks them, emails the brand and moves the deal to waiting for brand", async () => {
    const d = await readyDeal();
    expect(await api.createInviteLink(d.id)).toEqual({ ok: false, error: "rejected" });
    await fillTerms(d.id, d.deliverables.map((x) => x.id));
    await api.updateInvite(d.id, { brandEmail: "sam@glowtheory.com" });
    const r = await api.createInviteLink(d.id);
    expect(r.ok && r.data).toMatchObject({ step: "waiting_for_brand", link: { emailedTo: "sam@glowtheory.com", expired: false } });
    expect(await api.updateInvitePost(d.id, d.deliverables[0].id, { amount: "1.00" })).toEqual({ ok: false, error: "rejected" });
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.find((x) => x.id === d.id)).toMatchObject({ step: "waiting_for_brand", status: "Waiting for brand" });
  });

  test("a new link replaces the old one; changing terms turns the link off and reopens editing", async () => {
    const d = await readyDeal();
    await fillTerms(d.id, d.deliverables.map((x) => x.id));
    const first = await api.createInviteLink(d.id);
    const renewed = await api.renewInviteLink(d.id);
    expect(renewed.ok && first.ok && renewed.data.link!.url).not.toBe(first.ok && first.data.link!.url);
    const changed = await api.turnOffInviteLink(d.id);
    expect(changed.ok && changed.data).toMatchObject({ step: "invite" });
    expect(changed.ok && changed.data.link).toBeUndefined();
  });
});

describe("IN-FR-03 back to the checklist", () => {
  test("reopening the checklist moves the deal back and keeps the terms", async () => {
    const d = await readyDeal();
    await api.updateInvitePost(d.id, d.deliverables[0].id, { amount: "1200.00" });
    const r = await api.reopenChecklist(d.id);
    expect(r.ok && r.data).toMatchObject({ step: "checklist", ready: false });
    await api.markChecklistReady(d.id);
    const back = await api.getInvite(d.id);
    expect(back.ok && back.data.posts[0].amount).toBe("1200.00");
  });
});

describe("IN 1.1 the seeded demo deal", () => {
  test("Pine & Co is already at the invite step, checklist ready, amounts and deadlines blank", async () => {
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.find((d) => d.brandName === "Pine & Co")).toMatchObject({ id: "deal_pine", step: "invite", status: "Invite" });
    const r = await api.getInvite("deal_pine");
    expect(r.ok && r.data.posts.map((p) => [p.platform, p.itemCount > 0, p.amount, p.deadlineDays])).toEqual([
      ["youtube_video", true, undefined, undefined],
      ["instagram_reel", true, undefined, undefined],
    ]);
  });
});
