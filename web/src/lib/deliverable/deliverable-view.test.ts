import { describe, expect, test } from "vitest";
import type { ItemStatus } from "@/lib/checklist/item-status";
import type { ChecklistItem, Deliverable } from "./types";
import { deliverableView } from "./deliverable-view";

const NOW = new Date("2026-10-06T12:00:00Z");

const item = (id: string, status: ItemStatus, extra: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  name: `Item ${id}`,
  kind: "said",
  status,
  briefLine: { number: 1, text: "A brief line." },
  checkedBy: "ai_timestamp",
  ...extra,
});

const deliverable = (overrides: Partial<Deliverable> = {}): Deliverable => ({
  id: "del_1",
  brandName: "Glow Theory",
  platform: "youtube_video",
  state: "results",
  deadline: "2026-10-24T23:59:00Z",
  items: [],
  hold: { amountMinor: 120000, currency: "USD", reference: "7HK21934LM", heldAt: "2026-10-03T10:00:00Z", stage: "held" },
  payoutEmail: "ada.okafor@example.com",
  ...overrides,
});

describe("DC-FR-20 checklist tabs", () => {
  test("counts each tab, with Waiting for brand shown only when something is waiting", () => {
    const view = deliverableView(
      deliverable({
        items: [
          item("1", "passed"),
          item("2", "fix_needed"),
          item("3", "unsure"),
          item("4", "accepted_by_brand"),
          item("5", "at_live_check"),
        ],
      }),
      NOW,
    );
    expect(view.tabs).toEqual([
      { id: "all", label: "All", count: 5 },
      { id: "needs_you", label: "Needs you", count: 2 },
      { id: "passed", label: "Passed", count: 2 },
      { id: "at_live_check", label: "At live check", count: 1 },
    ]);
  });

  test("shows Waiting for brand, named, when an item is waiting", () => {
    const view = deliverableView(deliverable({ items: [item("1", "waiting_for_brand")] }), NOW);
    expect(view.tabs).toContainEqual({ id: "waiting_for_brand", label: "Waiting for Glow Theory", count: 1 });
  });

  test("DC-FR-03: no tabs while the draft is being checked or before a draft", () => {
    const items = [item("1", "checking"), item("2", "at_live_check")];
    expect(deliverableView(deliverable({ state: "checking", items }), NOW).tabs).toEqual([]);
    expect(deliverableView(deliverable({ state: "no_draft", items }), NOW).tabs).toEqual([]);
  });
});

describe("DC-FR-21 default selection", () => {
  test("selects the first Fix needed item, then the first Unsure, then the first item", () => {
    const pick = (...statuses: ItemStatus[]) =>
      deliverableView(deliverable({ items: statuses.map((s, i) => item(String(i + 1), s)) }), NOW).defaultItemId;
    expect(pick("passed", "unsure", "fix_needed", "fix_needed")).toBe("3");
    expect(pick("passed", "waiting_for_brand", "unsure")).toBe("3");
    expect(pick("passed", "at_live_check")).toBe("1");
  });

  test("selects nothing when there are no items", () => {
    expect(deliverableView(deliverable({ items: [] }), NOW).defaultItemId).toBeNull();
  });
});

describe("DC-FR-19 change since last run", () => {
  const changeOf = (status: ItemStatus, previousStatus?: ItemStatus) =>
    deliverableView(deliverable({ items: [item("1", status, { previousStatus })] }), NOW).items[0].change;

  test("names the previous status when it differs", () => {
    expect(changeOf("passed", "fix_needed")).toBe("Was Fix needed");
    expect(changeOf("unsure", "accepted_by_brand")).toBe("Was accepted by Glow Theory");
  });

  test("shows nothing when the status is the same, there was no earlier run, or the item is still being checked", () => {
    expect(changeOf("passed", "passed")).toBeNull();
    expect(changeOf("passed")).toBeNull();
    expect(changeOf("checking", "fix_needed")).toBeNull();
    expect(changeOf("not_checked", "fix_needed")).toBeNull();
  });
});

describe("DC-FR-11 deadline warning", () => {
  const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();
  const warning = (hoursLeft: number, state: Deliverable["state"] = "results") =>
    deliverableView(deliverable({ state, deadline: hoursAhead(hoursLeft) }), NOW).deadlineWarning;

  test("warns only once fewer than 72 hours are left", () => {
    expect(warning(72)).toBeNull();
    expect(warning(71)).toBe("2 days left to post.");
    expect(warning(30)).toBe("1 day left to post.");
    expect(warning(5)).toBe("Less than a day left to post.");
  });

  test("warns only while the creator still has to act", () => {
    expect(warning(30, "no_draft")).not.toBeNull();
    expect(warning(30, "check_failed")).not.toBeNull();
    expect(warning(30, "checking")).toBeNull();
    expect(warning(30, "fully_passing")).toBeNull();
    expect(warning(30, "released")).toBeNull();
  });
});

describe("DC-FR-30 next step", () => {
  const next = (d: Partial<Deliverable>) => deliverableView(deliverable(d), NOW, { timeZone: "UTC" }).nextStep;

  test("DC-FR-02 no draft: upload it, against the agreed checklist", () => {
    expect(next({ state: "no_draft", items: [item("1", "not_checked"), item("2", "at_live_check")] })).toEqual({
      lead: "Upload your draft to start the draft check.",
      detail: "It’s checked against the 2 items you and Glow Theory agreed. Post by 24 Oct.",
      action: "upload_draft",
    });
  });

  test("DC-FR-03 checking: counts only items checked before publishing, and nothing to do", () => {
    const items = [item("1", "checking"), item("2", "passed"), item("3", "at_live_check")];
    expect(next({ state: "checking", items })).toEqual({
      lead: "We’re checking your draft against the 2 items that can be checked before publishing.",
      detail: "You can leave this page; results will be here when it’s done.",
      action: null,
    });
  });

  test("results: fix the items that need it, before the brand's review can start", () => {
    expect(next({ items: [item("1", "fix_needed"), item("2", "unsure"), item("3", "passed")] })).toEqual({
      lead: "Fix 2 items, then upload a new draft.",
      detail: "Glow Theory’s 48-hour review starts once every item passes.",
      action: "upload_new_draft",
    });
  });

  test("DC-FR-18 results: names the brand and the deadline while an item waits for them", () => {
    expect(next({ items: [item("1", "fix_needed"), item("2", "waiting_for_brand")] })).toEqual({
      lead: "Fix 1 item, then upload a new draft.",
      detail: "1 item is waiting for Glow Theory; you can still fix it yourself. Post by 24 Oct.",
      action: "upload_new_draft",
    });
    expect(next({ items: [item("1", "waiting_for_brand"), item("2", "passed")] })).toEqual({
      lead: "1 item is waiting for Glow Theory.",
      detail: "You can still upload a fix yourself. Post by 24 Oct.",
      action: "upload_new_draft",
    });
  });

  test("DC-FR-11: the deadline warning leads the next step", () => {
    const view = deliverableView(
      deliverable({ deadline: "2026-10-07T18:00:00Z", items: [item("1", "fix_needed")] }),
      NOW,
      { timeZone: "UTC" },
    );
    expect(view.nextStep.lead).toBe("1 day left to post. Fix 1 item, then upload a new draft.");
  });

  test("DC-FR-07 fully passing: names the brand and when the review window ends, nothing to do", () => {
    expect(next({ state: "fully_passing", reviewWindowEndsAt: "2026-10-09T14:00:00Z" })).toEqual({
      lead: "Every item passed. Glow Theory has until Fri 9 Oct, 14:00 to review.",
      detail: "If they say nothing by then, you’re cleared to publish.",
      action: null,
    });
  });

  test("DC-FR-08, DC-FR-28 check failed on the file: say what to do, and that the hold is safe", () => {
    expect(
      next({
        state: "check_failed",
        checkFailure: { kind: "file", reason: "too_long", fileName: "draft_v3.mp4", lengthSec: 860, lengthCapSec: 720 },
      }),
    ).toEqual({
      lead: "Upload a shorter cut of your draft.",
      detail: "draft_v3.mp4 is 14:20 long, and drafts can be up to 12:00. Your $1,200.00 hold is still in place.",
      action: "upload_again",
    });
  });

  test("DC-FR-09 check failed on our side: not the creator's fault, retry or nothing to do", () => {
    const failure = (retrying: boolean) => ({ kind: "ours" as const, retrying, fileName: "draft_v3.mp4" });
    expect(next({ state: "check_failed", checkFailure: failure(true) })).toEqual({
      lead: "Nothing to do right now.",
      detail:
        "Something went wrong on our side checking draft_v3.mp4, and we’re trying again. Your $1,200.00 hold is still in place.",
      action: null,
    });
    expect(next({ state: "check_failed", checkFailure: failure(false) })).toEqual({
      lead: "Something went wrong on our side checking draft_v3.mp4.",
      detail: "It isn’t a problem with your video. Your $1,200.00 hold is still in place.",
      action: "try_again",
    });
  });

  test("DC-FR-08: each file problem says what is wrong and what to do", () => {
    const fileStep = (reason: "unreadable" | "format" | "not_same_video") =>
      next({ state: "check_failed", checkFailure: { kind: "file", reason, fileName: "draft_v3.mp4" } });
    expect(fileStep("unreadable")).toMatchObject({
      lead: "Upload your draft again.",
      detail: "We couldn’t read draft_v3.mp4; the file may be damaged. Your $1,200.00 hold is still in place.",
    });
    expect(fileStep("format")).toMatchObject({
      lead: "Upload your draft as a different file type.",
      detail: "We can’t check draft_v3.mp4 in this format. Your $1,200.00 hold is still in place.",
    });
    expect(fileStep("not_same_video")).toMatchObject({
      lead: "Upload the same video you put on YouTube as unlisted.",
      detail: "draft_v3.mp4 doesn’t match your unlisted YouTube upload. Your $1,200.00 hold is still in place.",
    });
  });

  test("DC-FR-10 released: where the money went, when, why, and that nothing more can happen", () => {
    const released = (extra: Partial<Deliverable>) =>
      next({ state: "released", releasedAt: "2026-10-12T09:00:00Z", ...extra });
    expect(released({ releaseReason: "deadline", releasedAt: "2026-10-25T09:00:00Z" })).toEqual({
      lead: "The hold went back to Glow Theory.",
      detail:
        "The deadline of 24 Oct passed before a passing draft was published, so the $1,200.00 hold was released on 25 Oct. Nothing more can happen on this deliverable.",
      action: null,
    });
    expect(released({ releaseReason: "cancelled", cancelledBy: "brand" }).detail).toBe(
      "Glow Theory cancelled the deal on 12 Oct, so the $1,200.00 hold went back to them. Nothing more can happen on this deliverable.",
    );
    expect(released({ releaseReason: "cancelled", cancelledBy: "creator" }).detail).toBe(
      "You cancelled the deal on 12 Oct, so the $1,200.00 hold went back to Glow Theory. Nothing more can happen on this deliverable.",
    );
    expect(released({ releaseReason: "cancelled" }).detail).toBe(
      "The deal was cancelled on 12 Oct, so the $1,200.00 hold went back to Glow Theory. Nothing more can happen on this deliverable.",
    );
  });

  test("still says what happens next when the API leaves a detail out", () => {
    expect(next({ state: "fully_passing" }).lead).toBe(
      "Every item passed. Glow Theory has until the end of the review window to review.",
    );
    expect(next({ state: "check_failed" })).toEqual({
      lead: "We couldn’t check this draft.",
      detail: "Your $1,200.00 hold is still in place.",
      action: "upload_again",
    });
  });

  test("plural wording when several items wait for the brand", () => {
    const items = [item("1", "fix_needed"), item("2", "waiting_for_brand"), item("3", "waiting_for_brand")];
    expect(next({ items }).detail).toBe(
      "2 items are waiting for Glow Theory; you can still fix them yourself. Post by 24 Oct.",
    );
  });

  test("a too-long file without its lengths still says what to do", () => {
    const checkFailure = { kind: "file" as const, reason: "too_long" as const, fileName: "draft_v3.mp4" };
    expect(next({ state: "check_failed", checkFailure }).detail).toBe(
      "draft_v3.mp4 is longer than drafts can be. Your $1,200.00 hold is still in place.",
    );
  });
});

describe("DC-FR-32 title", () => {
  test("names the brand and the kind of post", () => {
    const title = (platform: Deliverable["platform"]) => deliverableView(deliverable({ platform }), NOW).title;
    expect(title("youtube_video")).toBe("Glow Theory · YouTube video");
    expect(title("youtube_short")).toBe("Glow Theory · YouTube Short");
    expect(title("instagram_reel")).toBe("Glow Theory · Instagram Reel");
  });
});
