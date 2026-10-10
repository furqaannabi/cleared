/**
 * The rules of a post's draft check and review, with no database and no service: what each side may do
 * and when, and what a draft's state is (draft check and review spec DR-FR-30 to DR-FR-43, DR-BR-02,
 * DR-BR-03, DR-BR-14, DR-BR-15).
 */
import { describe, expect, test } from "bun:test";
import { brandReview, brandStatus, creatorStatus, newReview, postState, review, type Checked, type ReviewEvent, type ReviewState } from "./rules";

const at = (iso: string) => new Date(iso);
const T0 = at("2026-10-10T09:00:00Z");
const settings = { windowHours: 48 };

/** Applies events in turn and returns where the post ends up. Fails the test if one is refused. */
function after(start: ReviewState, ...events: ReviewEvent[]): ReviewState {
  return events.reduce((state, event) => {
    const result = review(state, event, settings);
    if (!result.ok) throw new Error(`"${event.type}" was refused: ${result.reason}`);
    return result.state;
  }, start);
}

const results = (found: Record<string, Checked>) => Object.entries(found).map(([id, result]) => ({ id, result }));
/** A post whose first draft has just been checked, with these results. */
const checked = (found: Record<string, Checked>, when = T0) =>
  after(newReview(), { type: "draft_started", at: when }, { type: "run_finished", at: when, results: results(found) });

const allPass = { code: "passed", serum: "passed", link: "at_live_check" } as const;
const oneUnsure = { code: "passed", serum: "unsure", link: "at_live_check" } as const;

describe("DR-FR-01, DR-FR-05 sending a draft", () => {
  test("a post starts with no draft, and a draft sent starts a check", () => {
    expect(postState(newReview())).toBe("no_draft");
    expect(postState(after(newReview(), { type: "draft_started", at: T0 }))).toBe("checking");
  });

  test("a draft cannot be sent while a check is running, once a draft is approved, or once the hold is released", () => {
    const checking = after(newReview(), { type: "draft_started", at: T0 });
    const approved = after(checked(allPass), { type: "approve", at: T0 });
    const released = { ...checked(oneUnsure), released: true };

    expect(review(checking, { type: "draft_started", at: T0 }, settings)).toEqual({ ok: false, reason: "check_running" });
    expect(review(approved, { type: "draft_started", at: T0 }, settings)).toEqual({ ok: false, reason: "approved" });
    expect(review(released, { type: "draft_started", at: T0 }, settings)).toEqual({ ok: false, reason: "released" });
  });

  test("a finished run is one more run, and its results are the items' statuses", () => {
    const state = checked({ code: "passed", serum: "fix_needed", cap: "unsure", link: "at_live_check" });

    expect(state.run).toBe(1);
    expect(postState(state)).toBe("results");
    expect(state.items.map((item) => [item.id, creatorStatus(item)])).toEqual([
      ["code", "passed"],
      ["serum", "fix_needed"],
      ["cap", "unsure"],
      ["link", "at_live_check"],
    ]);
  });

  test("from the second run each item remembers its status in the run before", () => {
    const first = after(checked({ code: "fix_needed", serum: "unsure" }), { type: "ask", itemId: "serum", at: T0 });
    const second = after(first, { type: "draft_started", at: T0 }, { type: "run_finished", at: T0, results: results({ code: "passed", serum: "unsure" }) });

    expect(second.run).toBe(2);
    expect(second.items).toMatchObject([
      { id: "code", result: "passed", previous: "fix_needed" },
      { id: "serum", result: "unsure", previous: "waiting_for_brand" },
    ]);
    expect(checked(allPass).items[0]).not.toHaveProperty("previous");
  });

  test("a check that fails on Cleared's side is not a run: the number stays and the last results stay", () => {
    const first = checked(oneUnsure);
    const failed = after(first, { type: "draft_started", at: T0 }, { type: "run_failed", at: T0 });

    expect(postState(failed)).toBe("check_failed");
    expect(failed.run).toBe(1);
    expect(failed.items.map((item) => item.result)).toEqual(first.items.map((item) => item.result));
    // The same draft's check can be started again.
    expect(postState(after(failed, { type: "draft_started", at: T0 }))).toBe("checking");
  });
});

describe("DR-BR-14 a new draft cancels what the run before it had", () => {
  test("open asks, acceptances and the review window all end when a new draft starts", () => {
    const asked = after(checked({ code: "passed", serum: "unsure", cap: "unsure" }), { type: "ask", itemId: "serum", at: T0 }, { type: "ask", itemId: "cap", at: T0 }, { type: "accept", itemId: "serum", at: T0 });
    const inWindow = checked(allPass);

    for (const before of [asked, inWindow]) {
      const result = review(before, { type: "draft_started", at: T0 }, settings);
      if (!result.ok) throw new Error(result.reason);
      expect(result.state).toMatchObject({ window: null, objectedAt: null, shown: false });
      expect(result.state.items.every((item) => item.ask === "none" && !item.objected)).toBe(true);
      expect(result.effects).toContainEqual({ type: "end_review_link" });
    }
  });

  test("objections end too, and the brand's review starts from nothing", () => {
    const objected = after(checked(allPass), { type: "object", itemIds: ["code"], at: T0 });
    const next = after(objected, { type: "draft_started", at: T0 });

    expect(next.objectedAt).toBeNull();
    expect(brandReview(next)).toEqual({ state: "nothing_yet" });
  });
});

describe("DR-FR-30 to DR-FR-34 asking the brand", () => {
  test("only an unsure item can be put to the brand", () => {
    const state = checked({ code: "passed", serum: "fix_needed", cap: "unsure", link: "at_live_check" });

    expect(review(state, { type: "ask", itemId: "cap", at: T0 }, settings)).toMatchObject({ ok: true });
    expect(review(state, { type: "ask", itemId: "code", at: T0 }, settings)).toEqual({ ok: false, reason: "not_unsure" });
    expect(review(state, { type: "ask", itemId: "serum", at: T0 }, settings)).toEqual({ ok: false, reason: "not_unsure" });
    expect(review(state, { type: "ask", itemId: "link", at: T0 }, settings)).toEqual({ ok: false, reason: "not_unsure" });
    expect(review(state, { type: "ask", itemId: "nope", at: T0 }, settings)).toEqual({ ok: false, reason: "unknown_item" });
  });

  test("an asked item is waiting for the brand, and the first ask of a run makes the brand's link", () => {
    const state = checked({ serum: "unsure", cap: "unsure" });

    const first = review(state, { type: "ask", itemId: "serum", at: T0 }, settings);
    if (!first.ok) throw new Error(first.reason);
    expect(creatorStatus(first.state.items[0]!)).toBe("waiting_for_brand");
    expect(brandStatus(first.state.items[0]!)).toBe("asked");
    expect(first.effects).toEqual([{ type: "make_review_link" }]);

    const second = review(first.state, { type: "ask", itemId: "cap", at: T0 }, settings);
    expect(second).toMatchObject({ ok: true, effects: [] });
    expect(review(first.state, { type: "ask", itemId: "serum", at: T0 }, settings)).toEqual({ ok: false, reason: "not_unsure" });
  });

  test("an ask can be withdrawn, and the item is unsure again", () => {
    const state = after(checked(oneUnsure), { type: "ask", itemId: "serum", at: T0 }, { type: "withdraw", itemId: "serum", at: T0 });

    expect(creatorStatus(state.items[1]!)).toBe("unsure");
    expect(review(state, { type: "withdraw", itemId: "serum", at: T0 }, settings)).toEqual({ ok: false, reason: "not_waiting" });
    expect(review(state, { type: "ask", itemId: "serum", at: T0 }, settings)).toMatchObject({ ok: true });
  });

  test("the brand accepts a waiting item, and it then counts as passed without being called passed", () => {
    const state = after(checked({ code: "passed", serum: "unsure", cap: "unsure" }), { type: "ask", itemId: "serum", at: T0 }, { type: "accept", itemId: "serum", at: T0 });

    expect(creatorStatus(state.items[1]!)).toBe("accepted_by_brand");
    expect(brandStatus(state.items[1]!)).toBe("accepted");
    expect(postState(state)).toBe("results");
    expect(review(state, { type: "accept", itemId: "cap", at: T0 }, settings)).toEqual({ ok: false, reason: "not_waiting" });
  });

  test("the brand asks for a fix instead: the item is unsure, marked declined, and cannot be asked about again in this run", () => {
    const state = after(checked(oneUnsure), { type: "ask", itemId: "serum", at: T0 }, { type: "ask_fix", itemId: "serum", at: T0 });

    expect(state.items[1]).toMatchObject({ ask: "declined" });
    expect(creatorStatus(state.items[1]!)).toBe("unsure");
    expect(brandStatus(state.items[1]!)).toBe("fix_requested");
    expect(review(state, { type: "ask", itemId: "serum", at: T0 }, settings)).toEqual({ ok: false, reason: "already_declined" });
    expect(review(state, { type: "ask_fix", itemId: "serum", at: T0 }, settings)).toEqual({ ok: false, reason: "not_waiting" });
  });

  test("a waiting item waits with no time limit", () => {
    const state = after(checked(oneUnsure), { type: "ask", itemId: "serum", at: T0 });
    const muchLater = review(state, { type: "window_due", at: at("2026-12-01T00:00:00Z") }, settings);

    expect(muchLater).toMatchObject({ ok: true, state: { approved: null }, effects: [] });
    expect(creatorStatus(state.items[1]!)).toBe("waiting_for_brand");
  });

  test("nothing can be asked, withdrawn or answered before a run has finished, or while a check runs", () => {
    const checking = after(checked(oneUnsure), { type: "draft_started", at: T0 });

    for (const state of [newReview(), checking]) {
      for (const type of ["ask", "withdraw", "accept", "ask_fix"] as const) {
        expect(review(state, { type, itemId: "serum", at: T0 }, settings)).toEqual({ ok: false, reason: "no_results" });
      }
    }
  });
});

describe("DR-FR-35, DR-FR-36 the review window", () => {
  test("a run whose items are all passed opens the window for 48 hours, and at-live-check items do not hold it back", () => {
    const result = review(after(newReview(), { type: "draft_started", at: T0 }), { type: "run_finished", at: T0, results: results(allPass) }, settings);
    if (!result.ok) throw new Error(result.reason);

    expect(postState(result.state)).toBe("fully_passing");
    expect(result.state.window).toEqual({ openedAt: T0, endsAt: at("2026-10-12T09:00:00Z") });
    expect(result.effects).toEqual([{ type: "make_review_link" }, { type: "schedule_window_end", at: at("2026-10-12T09:00:00Z") }]);
    expect(brandReview(result.state)).toEqual({ state: "window", endsAt: at("2026-10-12T09:00:00Z") });
  });

  test.each([
    ["a fix needed item", { code: "passed", serum: "fix_needed" }],
    ["an unsure item", { code: "passed", serum: "unsure" }],
  ] as const)("a run with %s opens no window", (_what, found) => {
    const state = checked(found);

    expect(state.window).toBeNull();
    expect(postState(state)).toBe("results");
  });

  test("the window opens later, when the brand accepts the last item that was not passed", () => {
    const waiting = after(checked({ code: "passed", serum: "unsure", cap: "unsure" }), { type: "ask", itemId: "serum", at: T0 }, { type: "ask", itemId: "cap", at: T0 }, { type: "accept", itemId: "serum", at: T0 });
    expect(waiting.window).toBeNull();

    const later = at("2026-10-11T12:00:00Z");
    const result = review(waiting, { type: "accept", itemId: "cap", at: later }, settings);
    if (!result.ok) throw new Error(result.reason);

    expect(postState(result.state)).toBe("fully_passing");
    expect(result.state.window).toEqual({ openedAt: later, endsAt: at("2026-10-13T12:00:00Z") });
    expect(result.effects).toContainEqual({ type: "schedule_window_end", at: at("2026-10-13T12:00:00Z") });
  });

  test("an item only asked about, or asked to be fixed, does not make a draft fully passing", () => {
    const asked = after(checked(oneUnsure), { type: "ask", itemId: "serum", at: T0 });
    const declined = after(asked, { type: "ask_fix", itemId: "serum", at: T0 });

    expect(asked.window).toBeNull();
    expect(declined.window).toBeNull();
  });
});

describe("DR-BR-02, DR-FR-40 silence approves a fully passing draft and nothing else", () => {
  const end = at("2026-10-12T09:00:00Z");

  test("when the window ends with no objection, the draft is approved by the window and cleared", () => {
    const result = review(checked(allPass), { type: "window_due", at: end }, settings);
    if (!result.ok) throw new Error(result.reason);

    expect(result.state.approved).toEqual({ by: "window", at: end });
    expect(postState(result.state)).toBe("approved");
    expect(result.effects).toEqual([{ type: "clear_draft" }, { type: "end_review_link" }]);
  });

  test("before the window's end nothing happens", () => {
    expect(review(checked(allPass), { type: "window_due", at: at("2026-10-12T08:59:59Z") }, settings)).toMatchObject({ ok: true, state: { approved: null }, effects: [] });
  });

  test("the timer of a window that a new draft ended does nothing, even if the new draft has a window of its own", () => {
    const second = at("2026-10-11T09:00:00Z");
    const newDraft = after(checked(allPass), { type: "draft_started", at: second }, { type: "run_finished", at: second, results: results(allPass) });

    // The first window's timer fires at its old end. The new window runs to the 13th.
    expect(review(newDraft, { type: "window_due", at: end }, settings)).toMatchObject({ ok: true, state: { approved: null }, effects: [] });
    expect(review(newDraft, { type: "window_due", at: at("2026-10-13T09:00:00Z") }, settings)).toMatchObject({ ok: true, state: { approved: { by: "window" } } });
  });

  test.each([
    ["a new draft that is still being checked", (state: ReviewState) => after(state, { type: "draft_started", at: T0 })],
    ["a new draft that did not pass", (state: ReviewState) => after(state, { type: "draft_started", at: T0 }, { type: "run_finished", at: T0, results: results(oneUnsure) })],
    ["an objection", (state: ReviewState) => after(state, { type: "object", itemIds: ["code"], at: T0 })],
    ["a released hold", (state: ReviewState) => ({ ...state, released: true })],
  ])("after %s, the timer approves nothing", (_what, change) => {
    const result = review(change(checked(allPass)), { type: "window_due", at: at("2026-12-01T00:00:00Z") }, settings);

    expect(result).toMatchObject({ ok: true, state: { approved: null }, effects: [] });
  });

  test("a timer that fires twice approves once", () => {
    const once = review(checked(allPass), { type: "window_due", at: end }, settings);
    if (!once.ok) throw new Error(once.reason);

    expect(review(once.state, { type: "window_due", at: end }, settings)).toEqual({ ok: true, state: once.state, effects: [] });
  });

  test("an unsure, a waiting or a fix needed item never clears on a timer", () => {
    for (const state of [checked(oneUnsure), after(checked(oneUnsure), { type: "ask", itemId: "serum", at: T0 }), checked({ code: "fix_needed" })]) {
      expect(review(state, { type: "window_due", at: at("2026-12-01T00:00:00Z") }, settings)).toMatchObject({ state: { approved: null }, effects: [] });
    }
  });
});

describe("DR-FR-37 the brand approves", () => {
  test("in the window: approved by the brand, cleared, and its link ends", () => {
    const when = at("2026-10-10T15:00:00Z");
    const result = review(checked(allPass), { type: "approve", at: when }, settings);

    expect(result).toEqual({ ok: true, state: expect.objectContaining({ approved: { by: "brand", at: when }, window: null }), effects: [{ type: "clear_draft" }, { type: "end_review_link" }] });
  });

  test("after it objected, it can approve the same draft anyway", () => {
    const objected = after(checked(allPass), { type: "object", itemIds: ["code"], at: T0 });

    expect(review(objected, { type: "approve", at: T0 }, settings)).toMatchObject({ ok: true, state: { approved: { by: "brand" } } });
  });

  test("a draft that is not fully passing cannot be approved", () => {
    expect(review(checked(oneUnsure), { type: "approve", at: T0 }, settings)).toEqual({ ok: false, reason: "nothing_to_approve" });
    expect(review(newReview(), { type: "approve", at: T0 }, settings)).toEqual({ ok: false, reason: "nothing_to_approve" });
  });

  test("it cannot be approved twice", () => {
    const approved = after(checked(allPass), { type: "approve", at: T0 });

    expect(review(approved, { type: "approve", at: T0 }, settings)).toEqual({ ok: false, reason: "approved" });
  });
});

describe("DR-FR-38, DR-FR-39, DR-BR-15 objections", () => {
  test("the brand objects to passed items together: the clock stops and the post is objected", () => {
    const when = at("2026-10-11T10:00:00Z");
    const result = review(checked({ code: "passed", serum: "passed", link: "at_live_check" }), { type: "object", itemIds: ["code", "serum"], at: when }, settings);
    if (!result.ok) throw new Error(result.reason);

    expect(result.state).toMatchObject({ objectedAt: when, window: null });
    expect(postState(result.state)).toBe("objected");
    expect(brandReview(result.state)).toEqual({ state: "objected", objectedAt: when });
    expect(result.state.items.map((item) => creatorStatus(item))).toEqual(["objected_by_brand", "objected_by_brand", "at_live_check"]);
    expect(result.state.items.map((item) => brandStatus(item))).toEqual(["objected", "objected", "at_live_check"]);
    expect(result.effects).toEqual([]);
  });

  test("only an item that passed can be objected to: not an accepted one, not an at-live-check one, not an unknown one", () => {
    const state = after(checked({ code: "passed", serum: "unsure", link: "at_live_check" }), { type: "ask", itemId: "serum", at: T0 }, { type: "accept", itemId: "serum", at: T0 });

    expect(review(state, { type: "object", itemIds: ["code", "serum"], at: T0 }, settings)).toEqual({ ok: false, reason: "not_passed" });
    expect(review(state, { type: "object", itemIds: ["link"], at: T0 }, settings)).toEqual({ ok: false, reason: "not_passed" });
    expect(review(state, { type: "object", itemIds: ["nope"], at: T0 }, settings)).toEqual({ ok: false, reason: "unknown_item" });
    expect(review(state, { type: "object", itemIds: [], at: T0 }, settings)).toEqual({ ok: false, reason: "nothing_to_object" });
    expect(review(state, { type: "object", itemIds: ["code"], at: T0 }, settings)).toMatchObject({ ok: true });
  });

  test("objections are sent once per draft", () => {
    const objected = after(checked(allPass), { type: "object", itemIds: ["code"], at: T0 });

    expect(review(objected, { type: "object", itemIds: ["serum"], at: T0 }, settings)).toEqual({ ok: false, reason: "already_objected" });
  });

  test("outside a window there is nothing to object to", () => {
    expect(review(checked(oneUnsure), { type: "object", itemIds: ["code"], at: T0 }, settings)).toEqual({ ok: false, reason: "window_not_open" });
  });

  test("too late has its own answer: once the window's time is up, whether or not its timer has run yet", () => {
    const end = at("2026-10-12T09:00:00Z");
    const open = checked(allPass);
    const approvedBySilence = after(open, { type: "window_due", at: end });

    expect(review(open, { type: "object", itemIds: ["code"], at: end }, settings)).toEqual({ ok: false, reason: "window_ended" });
    expect(review(approvedBySilence, { type: "object", itemIds: ["code"], at: end }, settings)).toEqual({ ok: false, reason: "window_ended" });
    expect(review(open, { type: "object", itemIds: ["code"], at: at("2026-10-12T08:59:59Z") }, settings)).toMatchObject({ ok: true });
  });

  test("after an objection the post waits on the two sides, and the timer never approves it", () => {
    const objected = after(checked(allPass), { type: "object", itemIds: ["code"], at: T0 });

    expect(review(objected, { type: "window_due", at: at("2026-12-01T00:00:00Z") }, settings)).toMatchObject({ state: { approved: null }, effects: [] });
    expect(review(objected, { type: "draft_started", at: T0 }, settings)).toMatchObject({ ok: true });
  });
});

describe("DR-FR-42, DR-FR-43 approved and released posts take nothing more", () => {
  const events: ReviewEvent[] = [
    { type: "draft_started", at: T0 },
    { type: "ask", itemId: "serum", at: T0 },
    { type: "withdraw", itemId: "serum", at: T0 },
    { type: "accept", itemId: "serum", at: T0 },
    { type: "ask_fix", itemId: "serum", at: T0 },
    { type: "object", itemIds: ["code"], at: T0 },
    { type: "approve", at: T0 },
  ];

  test("once approved, no draft, ask, answer or objection is taken", () => {
    const approved = after(checked(allPass), { type: "approve", at: T0 });

    for (const event of events) expect(review(approved, event, settings)).toEqual({ ok: false, reason: "approved" });
  });

  test("once the hold is released, everything is refused and the post reads released", () => {
    const released = { ...after(checked(oneUnsure), { type: "ask", itemId: "serum", at: T0 }), released: true };

    for (const event of events) expect(review(released, event, settings)).toEqual({ ok: false, reason: "released" });
    expect(postState(released)).toBe("released");
    expect(brandReview(released)).toEqual({ state: "released" });
  });
});

describe("DR-FR-48 the brand is shown a draft only from an ask or a window", () => {
  test("a run nobody asked about, with no window, shows the brand nothing yet", () => {
    const state = checked(oneUnsure);

    expect(state.shown).toBe(false);
    expect(brandReview(state)).toEqual({ state: "nothing_yet" });
  });

  test("from the first ask the brand is shown it, and stays shown if the ask is withdrawn", () => {
    const asked = after(checked(oneUnsure), { type: "ask", itemId: "serum", at: T0 });
    const withdrawn = after(asked, { type: "withdraw", itemId: "serum", at: T0 });

    expect(asked.shown).toBe(true);
    expect(brandReview(asked)).toEqual({ state: "asked" });
    expect(withdrawn.shown).toBe(true);
  });

  test("an approved draft stays shown to the brand, as approved", () => {
    const when = at("2026-10-10T15:00:00Z");

    expect(brandReview(after(checked(allPass), { type: "approve", at: when }))).toEqual({ state: "approved", approvedAt: when, by: "brand" });
  });
});

describe("DR-BR-03 unsure is unsure", () => {
  test("no path turns an unsure result into passed: only the brand's acceptance changes how it reads, and never to passed", () => {
    const start = checked(oneUnsure);
    const paths: ReviewEvent[][] = [
      [{ type: "ask", itemId: "serum", at: T0 }],
      [{ type: "ask", itemId: "serum", at: T0 }, { type: "withdraw", itemId: "serum", at: T0 }],
      [{ type: "ask", itemId: "serum", at: T0 }, { type: "accept", itemId: "serum", at: T0 }],
      [{ type: "ask", itemId: "serum", at: T0 }, { type: "ask_fix", itemId: "serum", at: T0 }],
      [{ type: "window_due", at: at("2026-12-01T00:00:00Z") }],
    ];

    for (const path of paths) {
      const item = after(start, ...path).items[1]!;
      expect(item.result).toBe("unsure");
      expect(creatorStatus(item)).not.toBe("passed");
      expect(brandStatus(item)).not.toBe("passed");
    }
  });
});
