import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { setReadingSpeed } from "@/mocks/deal-drafts";

const BRIEF = [
  "Thanks for partnering with Glow Theory on the Dew Drop serum launch!",
  "In the YouTube video, say “Glow Theory” in the first 60 seconds.",
  "Mention us early in the Reel.",
  "Say and show the code GLOW20.",
  "Put #GlowPartner in the Reel caption.",
  "Keep it fun and authentic!",
  "Mark the post as a paid promotion.",
].join("\n");

async function newDeal() {
  const r = await api.createDeal({ brandName: "Glow Theory", deliverables: [{ platform: "youtube_video" }, { platform: "instagram_reel" }] });
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

async function readDeal() {
  setReadingSpeed(0);
  const d = await newDeal();
  await api.submitBrief(d.id, BRIEF);
  const r = await api.getDealDraft(d.id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

describe("BC-FR-03 creating a deal", () => {
  test("creates the deal with its deliverables, at the checklist step, and lists it", async () => {
    const d = await newDeal();
    expect(d).toMatchObject({ brandName: "Glow Theory", step: "checklist", reading: "idle", items: [], questions: [], ready: false });
    expect(d.deliverables.map((x) => x.platform)).toEqual(["youtube_video", "instagram_reel"]);
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.find((x) => x.id === d.id)).toMatchObject({ brandName: "Glow Theory", step: "checklist", status: "Checklist" });
  });

  test("refuses a deal with no brand or no deliverables", async () => {
    expect(await api.createDeal({ brandName: " ", deliverables: [{ platform: "youtube_video" }] })).toEqual({ ok: false, error: "rejected" });
    expect(await api.createDeal({ brandName: "Glow Theory", deliverables: [] })).toEqual({ ok: false, error: "rejected" });
  });
});

describe("BC-FR-04, BC-FR-07, BC-FR-11, BC-FR-13 reading the brief", () => {
  test("splits the brief into numbered lines and reads them over time", async () => {
    setReadingSpeed(60_000);
    const d = await newDeal();
    const r = await api.submitBrief(d.id, BRIEF);
    expect(r.ok && r.data).toMatchObject({ reading: "reading", readUpTo: 0 });
    expect(r.ok && r.data.brief?.lines[1]).toEqual({ number: 2, text: "In the YouTube video, say “Glow Theory” in the first 60 seconds." });
  });

  test("items cite their line and land on the right deliverables; vague lines become questions", async () => {
    const d = await readDeal();
    expect(d.reading).toBe("done");
    const [yt, reel] = d.deliverables.map((x) => x.id);
    const byLine = (n: number) => d.items.filter((i) => i.briefLine === n);
    // Line 2 names the YouTube video only.
    expect(byLine(2).map((i) => i.deliverableId)).toEqual([yt]);
    expect(byLine(2)[0]).toMatchObject({ kind: "timing", checkedBy: "ai_timestamp", addedByCreator: false });
    // Line 4 applies to every post: said and shown as text, both exact.
    expect(byLine(4).map((i) => [i.kind, i.checkedBy])).toEqual([
      ["said", "exact_match"],
      ["said", "exact_match"],
      ["shown_as_text", "exact_match"],
      ["shown_as_text", "exact_match"],
    ]);
    expect(byLine(5).map((i) => [i.deliverableId, i.kind, i.checkedBy])).toEqual([[reel, "written", "at_live_check"]]);
    expect(byLine(7).every((i) => i.kind === "disclosure")).toBe(true);
    expect(byLine(1)).toEqual([]);
    expect(d.questions.map((q) => q.briefLine)).toEqual([3, 6]);
    expect(d.questions[0].suggestions.length).toBeGreaterThanOrEqual(2);
  });
});

describe("BC-FR-13 answering questions", () => {
  test("a suggestion creates an item citing the line; reopening removes it; leaving out creates none", async () => {
    const d = await readDeal();
    const q = d.questions[0];
    const answered = await api.answerQuestion(d.id, q.id, { kind: "suggestion", text: q.suggestions[0] });
    expect(answered.ok && answered.data.items.filter((i) => i.briefLine === 3).length).toBe(1);
    const reopened = await api.reopenQuestion(d.id, q.id);
    expect(reopened.ok && reopened.data.items.filter((i) => i.briefLine === 3)).toEqual([]);
    const left = await api.answerQuestion(d.id, d.questions[1].id, { kind: "left_out" });
    expect(left.ok && left.data.questions[1].answer).toEqual({ kind: "left_out" });
    expect(left.ok && left.data.items.filter((i) => i.briefLine === 6)).toEqual([]);
  });

  test("own words become the item's wording", async () => {
    const d = await readDeal();
    const r = await api.answerQuestion(d.id, d.questions[0].id, { kind: "own_words", text: "Says Glow Theory before the first cut" });
    expect(r.ok && r.data.items.find((i) => i.briefLine === 3)?.name).toBe("Says Glow Theory before the first cut");
  });
});

describe("BC-FR-14 to BC-FR-16 changing items and marking ready", () => {
  test("edit, remove, copy, move and add", async () => {
    const d = await readDeal();
    const [yt, reel] = d.deliverables.map((x) => x.id);
    const first = d.items.find((i) => i.briefLine === 2)!;
    let r = await api.renameItem(d.id, first.id, "Says “Glow Theory” in the first minute");
    expect(r.ok && r.data.items.find((i) => i.id === first.id)?.name).toBe("Says “Glow Theory” in the first minute");
    r = await api.copyItem(d.id, first.id, reel);
    expect(r.ok && r.data.items.filter((i) => i.briefLine === 2).map((i) => i.deliverableId)).toEqual([yt, reel]);
    r = await api.removeItem(d.id, first.id);
    expect(r.ok && r.data.items.find((i) => i.id === first.id)).toBeUndefined();
    const disclosure = d.items.find((i) => i.briefLine === 7 && i.deliverableId === yt)!;
    r = await api.moveItem(d.id, disclosure.id, reel);
    expect(r.ok && r.data.items.find((i) => i.id === disclosure.id)?.deliverableId).toBe(reel);
    r = await api.addItem(d.id, { deliverableId: yt, name: "Shows the serum's packaging", kind: "shown" });
    expect(r.ok && r.data.items.at(-1)).toMatchObject({ addedByCreator: true, kind: "shown", checkedBy: "ai_timestamp" });
    expect(r.ok && r.data.items.at(-1)?.briefLine).toBeUndefined();
  });

  test("ready is refused while a question is open, then moves the deal to invite", async () => {
    const d = await readDeal();
    expect(await api.markChecklistReady(d.id)).toEqual({ ok: false, error: "rejected" });
    for (const q of d.questions) await api.answerQuestion(d.id, q.id, { kind: "left_out" });
    const r = await api.markChecklistReady(d.id);
    expect(r.ok && r.data).toMatchObject({ ready: true, step: "invite" });
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.find((x) => x.id === d.id)).toMatchObject({ step: "invite", status: "Invite" });
  });
});
