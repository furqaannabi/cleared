import { describe, expect, test } from "vitest";
import type { DealDraft } from "./types";
import { checklistView } from "./checklist-view";

const draft = (over: Partial<DealDraft> = {}): DealDraft => ({
  id: "deal_1",
  brandName: "Glow Theory",
  step: "checklist",
  deliverables: [
    { id: "yt", platform: "youtube_video" },
    { id: "ig", platform: "instagram_reel" },
  ],
  brief: {
    lines: [
      { number: 1, text: "Thanks for partnering with us!" },
      { number: 2, text: "Say and show the code GLOW20." },
      { number: 3, text: "Mention us early in the Reel." },
      { number: 4, text: "Keep it fun!" },
    ],
  },
  reading: "done",
  readUpTo: 4,
  items: [
    { id: "a", deliverableId: "yt", name: "Says the code GLOW20", kind: "said", briefLine: 2, addedByCreator: false, checkedBy: "exact_match" },
    { id: "b", deliverableId: "ig", name: "Says the code GLOW20", kind: "said", briefLine: 2, addedByCreator: false, checkedBy: "exact_match" },
    { id: "c", deliverableId: "yt", name: "Shows the code GLOW20 on screen", kind: "shown_as_text", briefLine: 2, addedByCreator: false, checkedBy: "exact_match" },
    { id: "d", deliverableId: "yt", name: "Shows the packaging", kind: "shown", addedByCreator: true, checkedBy: "ai_timestamp" },
  ],
  questions: [
    { id: "q1", briefLine: 3, text: "How early?", suggestions: ["In the first 10 seconds", "In the first 30 seconds"] },
    { id: "q2", briefLine: 4, text: "Leave it out?", suggestions: [] },
  ],
  ready: false,
  ...over,
});

describe("BC checklist view model", () => {
  test("BC-FR-09: one tab per deliverable with its item count; the first is current by default", () => {
    const v = checklistView(draft(), null);
    expect(v.tabs).toEqual([
      { id: "yt", label: "YouTube video", count: 3 },
      { id: "ig", label: "Instagram Reel", count: 1 },
    ]);
    expect(v.currentTab).toBe("yt");
    expect(checklistView(draft(), "ig").items.map((i) => i.id)).toEqual(["b"]);
  });

  test("BC-FR-10, BC-BR-01: items say their kind, how they're checked, and their line or that the creator added them", () => {
    const items = checklistView(draft(), "yt").items;
    expect(items.find((i) => i.id === "a")).toMatchObject({ kindLabel: "Said", howLabel: "Exact match", source: "Line 2", sourceText: "Say and show the code GLOW20." });
    expect(items.find((i) => i.id === "d")).toMatchObject({ kindLabel: "Shown", howLabel: "AI, with a timestamp", source: "Added by you, not in the brief", sourceText: null });
  });

  test("BC-FR-12: every brief line says what became of it", () => {
    const answered = draft({ questions: [{ id: "q1", briefLine: 3, text: "How early?", suggestions: [], answer: { kind: "suggestion", text: "In the first 10 seconds" } }, { id: "q2", briefLine: 4, text: "Leave it out?", suggestions: [], answer: { kind: "left_out" } }], items: [...draft().items, { id: "e", deliverableId: "ig", name: "Mentions Glow Theory in the first 10 seconds", kind: "timing", briefLine: 3, addedByCreator: false, checkedBy: "ai_timestamp" }] });
    expect(checklistView(draft(), null).lines.map((l) => [l.number, l.status])).toEqual([
      [1, "Not checked"],
      [2, "2 items"],
      [3, "Question"],
      [4, "Question"],
    ]);
    expect(checklistView(answered, null).lines.map((l) => l.status)).toEqual(["Not checked", "2 items", "1 item", "Not checked"]);
  });

  test("BC-FR-16, BC-BR-02: ready waits for every question and an item on every deliverable, saying what's left", () => {
    expect(checklistView(draft(), null).ready).toEqual({ allowed: false, left: "Answer 2 questions first." });
    const oneLeft = draft({ questions: [{ ...draft().questions[0], answer: { kind: "left_out" } }, draft().questions[1]] });
    expect(checklistView(oneLeft, null).ready).toEqual({ allowed: false, left: "Answer 1 question first." });
    const answeredNoReel = draft({
      questions: draft().questions.map((q) => ({ ...q, answer: { kind: "left_out" as const } })),
      items: draft().items.filter((i) => i.deliverableId === "yt"),
    });
    expect(checklistView(answeredNoReel, null).ready).toEqual({ allowed: false, left: "Add an item to the Instagram Reel first." });
    const allSet = draft({ questions: draft().questions.map((q) => ({ ...q, answer: { kind: "left_out" as const } })) });
    expect(checklistView(allSet, null).ready).toEqual({ allowed: true, left: null });
  });

  test("open questions come first, in line order", () => {
    expect(checklistView(draft(), null).openQuestions.map((q) => q.id)).toEqual(["q1", "q2"]);
  });
});
