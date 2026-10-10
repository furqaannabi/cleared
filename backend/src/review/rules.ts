/**
 * The rules of one post's draft check and review (draft check and review spec DR-FR-30 to DR-FR-43).
 * A pure function, in the way the money path's transitions are: given where the post stands and what
 * just happened, it answers where the post now stands and what has to follow, or why it is refused.
 * It reads no clock and reaches nothing. No model's word enters here except as a result already
 * decided by code (DR-BR-01).
 */

/** What the check found for an item. An item checked only on the published post is "at_live_check". */
export type Checked = "passed" | "fix_needed" | "unsure" | "at_live_check";

/** How an item reads to its creator. */
export type CreatorStatus = Checked | "waiting_for_brand" | "accepted_by_brand" | "objected_by_brand";

/** How the same item reads to the brand. */
export type BrandStatus = Checked | "asked" | "accepted" | "fix_requested" | "objected";

export interface ReviewItem {
  id: string;
  result: Checked;
  /** The creator's ask about an unsure item, and the brand's answer to it. */
  ask: "none" | "waiting" | "accepted" | "declined";
  /** The brand objected to it in the review window. */
  objected: boolean;
  /** How it read to its creator in the run before this one. Absent in the first run. */
  previous?: CreatorStatus;
  /**
   * How it read at the moment a newer draft arrived, before that draft cancelled its ask or objection.
   * Kept so the next run can say what changed ("was accepted by the brand, now unsure").
   */
  whenReplaced?: CreatorStatus;
}

export interface ReviewState {
  /** How many runs have finished. A check that fails is not a run (DR-BR-16). */
  run: number;
  phase: "no_draft" | "checking" | "check_failed" | "done";
  /** The latest finished run's items. They stay, as they were, while a newer draft is checked. */
  items: ReviewItem[];
  /** The open review window. Null before one opens, and once it ends for any reason. */
  window: { openedAt: Date; endsAt: Date } | null;
  objectedAt: Date | null;
  approved: { by: "brand" | "window"; at: Date } | null;
  /** Whether the brand is shown this run's draft: from the first ask, or the window's start (DR-FR-48). */
  shown: boolean;
  /** The money path has released or closed the hold. Set by the caller from the money path, never here. */
  released: boolean;
}

export type ReviewEvent =
  | { type: "draft_started"; at: Date }
  | { type: "run_finished"; at: Date; results: { id: string; result: Checked }[] }
  | { type: "run_failed"; at: Date }
  | { type: "ask" | "withdraw" | "accept" | "ask_fix"; itemId: string; at: Date }
  | { type: "object"; itemIds: string[]; at: Date }
  | { type: "approve"; at: Date }
  /** The window's timer fires. It may be late, early, or left over from a window that has ended. */
  | { type: "window_due"; at: Date };

/** What has to happen because of a change. The caller does these in the same transaction. */
export type ReviewEffect =
  | { type: "make_review_link" }
  | { type: "end_review_link" }
  | { type: "schedule_window_end"; at: Date }
  /** Tell the money path the draft is cleared to publish (MP-FR-10). */
  | { type: "clear_draft" };

export type ReviewRefusal =
  | "released"
  | "approved"
  | "check_running"
  | "no_check_running"
  | "no_results"
  | "unknown_item"
  | "not_unsure"
  | "already_declined"
  | "not_waiting"
  | "window_not_open"
  | "window_ended"
  | "already_objected"
  | "nothing_to_object"
  | "not_passed"
  | "nothing_to_approve";

export type ReviewResult = { ok: true; state: ReviewState; effects: ReviewEffect[] } | { ok: false; reason: ReviewRefusal };

export interface ReviewSettings {
  /** How long the brand has from a fully passing draft (DR-FR-36). */
  windowHours: number;
}

export const defaultReviewSettings: ReviewSettings = { windowHours: 48 };

export const newReview = (): ReviewState => ({
  run: 0,
  phase: "no_draft",
  items: [],
  window: null,
  objectedAt: null,
  approved: null,
  shown: false,
  released: false,
});

export function creatorStatus(item: ReviewItem): CreatorStatus {
  if (item.objected) return "objected_by_brand";
  if (item.ask === "waiting") return "waiting_for_brand";
  if (item.ask === "accepted") return "accepted_by_brand";
  // An item the brand asked to be fixed reads as it was found: unsure (DR-FR-33).
  return item.result;
}

export function brandStatus(item: ReviewItem): BrandStatus {
  if (item.objected) return "objected";
  if (item.ask === "waiting") return "asked";
  if (item.ask === "accepted") return "accepted";
  if (item.ask === "declined") return "fix_requested";
  return item.result;
}

/**
 * Whether every item checked at the draft check is passed or accepted by the brand (DR-FR-35). An
 * unsure, a waiting or a fix needed item is never rounded up (DR-BR-03).
 */
export function fullyPassing(items: ReviewItem[]): boolean {
  return items.every((item) => item.result === "at_live_check" || item.result === "passed" || item.ask === "accepted");
}

/** The post's state as its creator's page names it. */
export function postState(state: ReviewState) {
  if (state.released) return "released" as const;
  if (state.approved) return "approved" as const;
  if (state.phase !== "done") return state.phase;
  if (state.objectedAt) return "objected" as const;
  return state.window ? ("fully_passing" as const) : ("results" as const);
}

/** Where the brand's review of the latest draft stands. */
export function brandReview(state: ReviewState) {
  if (state.released) return { state: "released" as const };
  if (state.approved) return { state: "approved" as const, approvedAt: state.approved.at, by: state.approved.by };
  if (state.objectedAt) return { state: "objected" as const, objectedAt: state.objectedAt };
  if (state.window) return { state: "window" as const, endsAt: state.window.endsAt };
  return state.shown && state.phase === "done" ? { state: "asked" as const } : { state: "nothing_yet" as const };
}

/** Whether the creator may ask the brand about this item now (DR-FR-30). */
export function askable(state: ReviewState, item: ReviewItem): boolean {
  return !state.released && !state.approved && state.phase === "done" && creatorStatus(item) === "unsure" && item.ask !== "declined";
}

const refuse = (reason: ReviewRefusal): ReviewResult => ({ ok: false, reason });
const unchanged = (state: ReviewState): ReviewResult => ({ ok: true, state, effects: [] });

/** Opens the window if the run has just become fully passing, and shows the brand the draft. */
function withWindow(state: ReviewState, at: Date, settings: ReviewSettings): ReviewResult {
  if (state.window || !fullyPassing(state.items)) return { ok: true, state, effects: [] };
  const endsAt = new Date(at.getTime() + settings.windowHours * 60 * 60 * 1000);
  return {
    ok: true,
    state: { ...state, window: { openedAt: at, endsAt }, shown: true },
    effects: [...(state.shown ? [] : [{ type: "make_review_link" } as const]), { type: "schedule_window_end", at: endsAt }],
  };
}

/** The draft is approved: the window is over, the money path is told, and the brand's link has done its work. */
function approvedBy(state: ReviewState, by: "brand" | "window", at: Date): ReviewResult {
  return { ok: true, state: { ...state, approved: { by, at }, window: null }, effects: [{ type: "clear_draft" }, { type: "end_review_link" }] };
}

export function review(state: ReviewState, event: ReviewEvent, settings: ReviewSettings = defaultReviewSettings): ReviewResult {
  // The timer is not anyone's request, so it is never refused: it acts or it does nothing. It approves
  // only a window that is still open, on a run still fully passing, at or after the window's end (DR-BR-02).
  if (event.type === "window_due") {
    const due = !state.released && !state.approved && state.phase === "done" && state.window && !state.objectedAt;
    if (!due || event.at < state.window!.endsAt || !fullyPassing(state.items)) return unchanged(state);
    return approvedBy(state, "window", event.at);
  }

  if (state.released) return refuse("released");
  if (state.approved) {
    // Too late to object has its own answer (DR-FR-39).
    return refuse(event.type === "object" && state.approved.by === "window" ? "window_ended" : "approved");
  }

  switch (event.type) {
    case "draft_started": {
      if (state.phase === "checking") return refuse("check_running");
      // A new draft cancels every ask, acceptance and objection, and ends the window (DR-BR-14).
      const items = state.items.map((item) => ({
        ...item,
        ask: "none" as const,
        objected: false,
        // Kept from the first time this run was replaced, if a failed check is being started again.
        whenReplaced: item.whenReplaced ?? creatorStatus(item),
      }));
      return {
        ok: true,
        state: { ...state, phase: "checking", items, window: null, objectedAt: null, shown: false },
        effects: state.shown ? [{ type: "end_review_link" }] : [],
      };
    }

    case "run_finished": {
      if (state.phase !== "checking") return refuse("no_check_running");
      const items = event.results.map(({ id, result }): ReviewItem => {
        const before = state.run > 0 ? state.items.find((item) => item.id === id) : undefined;
        return { id, result, ask: "none", objected: false, ...(before ? { previous: before.whenReplaced ?? creatorStatus(before) } : {}) };
      });
      return withWindow({ ...state, run: state.run + 1, phase: "done", items }, event.at, settings);
    }

    case "run_failed":
      return state.phase === "checking" ? { ok: true, state: { ...state, phase: "check_failed" }, effects: [] } : refuse("no_check_running");

    case "ask":
    case "withdraw":
    case "accept":
    case "ask_fix": {
      if (state.phase !== "done") return refuse("no_results");
      const item = state.items.find((each) => each.id === event.itemId);
      if (!item) return refuse("unknown_item");
      const set = (ask: ReviewItem["ask"]) => ({ ...state, items: state.items.map((each) => (each === item ? { ...item, ask } : each)) });

      if (event.type === "ask") {
        if (item.ask === "declined") return refuse("already_declined");
        if (creatorStatus(item) !== "unsure") return refuse("not_unsure");
        // The first ask of a run is when the brand is first shown this draft.
        return { ok: true, state: { ...set("waiting"), shown: true }, effects: state.shown ? [] : [{ type: "make_review_link" }] };
      }
      if (item.ask !== "waiting") return refuse("not_waiting");
      if (event.type === "withdraw") return { ok: true, state: set("none"), effects: [] };
      if (event.type === "ask_fix") return { ok: true, state: set("declined"), effects: [] };
      // Accepting may be what makes the run fully passing, which opens the window (DR-FR-35).
      return withWindow(set("accepted"), event.at, settings);
    }

    case "object": {
      if (state.objectedAt) return refuse("already_objected");
      if (!state.window) return refuse("window_not_open");
      if (event.at >= state.window.endsAt) return refuse("window_ended");
      if (event.itemIds.length === 0) return refuse("nothing_to_object");
      const named = event.itemIds.map((id) => state.items.find((item) => item.id === id));
      if (named.some((item) => !item)) return refuse("unknown_item");
      // Only what the check itself passed: not what the brand accepted, nor what is checked live.
      if (named.some((item) => item!.result !== "passed")) return refuse("not_passed");
      const items = state.items.map((item) => (event.itemIds.includes(item.id) ? { ...item, objected: true } : item));
      // The clock stops. The timer already scheduled will find no window and do nothing.
      return { ok: true, state: { ...state, items, objectedAt: event.at, window: null }, effects: [] };
    }

    case "approve":
      return state.phase === "done" && (state.window || state.objectedAt) ? approvedBy(state, "brand", event.at) : refuse("nothing_to_approve");
  }
}
