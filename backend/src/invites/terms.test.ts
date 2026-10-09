import { describe, expect, test } from "bun:test";
import { cents, takeSnapshot, whatChanged, type TermsSnapshot } from "./terms";

describe("DS-BR-12 an amount is whole cents, never a floating-point number", () => {
  test("a decimal string with two places becomes whole cents exactly", () => {
    expect(cents("1200.00")).toBe(120_000);
    expect(cents("20.07")).toBe(2_007);
    expect(cents("0.29")).toBe(29);
    expect(cents("9999999.99")).toBe(999_999_999);
  });

  test("anything else is not an amount", () => {
    for (const text of ["1200", "1200.5", "1200.500", "-20.00", "1e3", "12,00.00", " 20.00", "20.00 ", "", ".50", "12345678.00"]) {
      expect(cents(text)).toBeUndefined();
    }
  });
});

describe("DS-FR-31 a version is the terms and the checklist as they were sent", () => {
  const post = { id: "post-1", platform: "youtube_video", amountCents: 120_000, deadlineDays: 14 };
  const item = {
    id: "item-1",
    deliverableId: "post-1",
    name: "Say the code GLOW20",
    kind: "said",
    briefLine: 2 as number | null,
    addedByCreator: false,
    exact: "GLOW20" as string | null,
    checkedBy: "exact_match",
    questionId: null as string | null,
  };

  test("it holds each post's amount and deadline, and every item with where it came from", () => {
    const own = { ...item, id: "item-2", name: "Wear the cap", kind: "shown", briefLine: null, addedByCreator: true, exact: null, checkedBy: "ai_timestamp" };
    const answered = { ...item, id: "item-3", name: "Mention Glow in the first 30 seconds", kind: "timing", briefLine: 3, exact: null, checkedBy: "ai_timestamp", questionId: "q-1" };

    const questions = [
      { briefLine: 3, answerKind: "suggestion", answerText: "In the first 30 seconds" },
      { briefLine: 5, answerKind: "left_out", answerText: null },
    ];

    expect(takeSnapshot({ deliverables: [post], items: [item, own, answered], questions })).toEqual({
      posts: [{ deliverableId: "post-1", platform: "youtube_video", amountCents: 120_000, deadlineDays: 14 }],
      items: [
        { id: "item-1", deliverableId: "post-1", name: "Say the code GLOW20", kind: "said", briefLine: 2, exact: "GLOW20", checkedBy: "exact_match", source: "brief" },
        { id: "item-2", deliverableId: "post-1", name: "Wear the cap", kind: "shown", checkedBy: "ai_timestamp", source: "creator" },
        { id: "item-3", deliverableId: "post-1", name: "Mention Glow in the first 30 seconds", kind: "timing", briefLine: 3, checkedBy: "ai_timestamp", source: "answer" },
      ],
      answers: [
        { briefLine: 3, kind: "suggestion", text: "In the first 30 seconds" },
        { briefLine: 5, kind: "left_out" },
      ],
    });
  });

  test("no version is taken while a post has no amount or no deadline", () => {
    expect(() => takeSnapshot({ deliverables: [{ ...post, amountCents: null }], items: [item], questions: [] })).toThrow();
    expect(() => takeSnapshot({ deliverables: [{ ...post, deadlineDays: null }], items: [item], questions: [] })).toThrow();
  });
});

describe("DS-FR-40 what changed between two versions", () => {
  const version = (over: { posts?: Partial<TermsSnapshot["posts"][number]>[]; items?: Partial<TermsSnapshot["items"][number]>[] } = {}): TermsSnapshot => ({
    posts: (over.posts ?? [{}]).map((post, index) => ({ deliverableId: `post-${index + 1}`, platform: "youtube_video", amountCents: 120_000, deadlineDays: 14, ...post })),
    items: (over.items ?? [{}]).map((item, index) => ({
      id: `item-${index + 1}`,
      deliverableId: "post-1",
      name: "Say the code GLOW20",
      kind: "said",
      briefLine: 2,
      checkedBy: "exact_match",
      source: "brief" as const,
      ...item,
    })),
    answers: [],
  });

  test("nothing changed between two versions that say the same", () => {
    expect(whatChanged(version(), version())).toEqual({ posts: {}, items: [] });
  });

  test("a post's amount and its deadline are each marked when they differ", () => {
    const after = version({ posts: [{ amountCents: 150_000 }, { deadlineDays: 10 }, { amountCents: 2_000, deadlineDays: 1 }, {}] });

    expect(whatChanged(version({ posts: [{}, {}, {}, {}] }), after)).toEqual({
      posts: { "post-1": ["amount"], "post-2": ["deadline"], "post-3": ["amount", "deadline"] },
      items: [],
    });
  });

  test("an item is marked when it is reworded, moved to another post, or new", () => {
    const before = version({ items: [{}, {}, {}] });
    const after = version({ items: [{ name: "Say the code GLOW25" }, { deliverableId: "post-2" }, {}, { id: "item-9", name: "Wear the cap" }] });

    expect(whatChanged(before, after).items).toEqual(["item-1", "item-2", "item-9"]);
  });

  test("an item taken away is in no list: there is nothing left to mark", () => {
    expect(whatChanged(version({ items: [{}, {}] }), version({ items: [{}] }))).toEqual({ posts: {}, items: [] });
  });

  test("the first version has nothing before it, so nothing in it is marked", () => {
    expect(whatChanged(undefined, version())).toEqual({ posts: {}, items: [] });
  });
});

