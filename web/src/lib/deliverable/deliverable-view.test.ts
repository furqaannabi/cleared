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
  creatorTimeZone: "UTC",
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
    expect(next({ items: [item("1", "fix_needed"), item("2", "fix_needed"), item("3", "passed")] })).toEqual({
      lead: "Fix 2 items, then upload a new draft.",
      detail: "Glow Theory’s 48-hour review starts once every item passes.",
      action: "upload_new_draft",
    });
  });

  test("results: an unsure item is a choice, fix it or ask the brand, not a fix", () => {
    expect(next({ items: [item("1", "fix_needed"), item("2", "unsure"), item("3", "passed")] })).toEqual({
      lead: "Fix 1 item, and decide on 1 unsure item.",
      detail:
        "For the unsure one, show it more clearly in a new draft or ask Glow Theory to accept it. Glow Theory’s 48-hour review starts once every item passes.",
      action: "upload_new_draft",
    });
    expect(next({ items: [item("1", "unsure"), item("2", "unsure"), item("3", "passed")] })).toEqual({
      lead: "Decide on 2 unsure items.",
      detail:
        "Show them more clearly in a new draft, or ask Glow Theory to accept them. Glow Theory’s 48-hour review starts once every item passes.",
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

  test("DC-FR-08, DC-FR-30 check failed on the file: the bar says what to do (the banner says why and that the hold is safe)", () => {
    expect(
      next({
        state: "check_failed",
        checkFailure: { kind: "file", reason: "too_long", fileName: "draft_v3.mp4", lengthSec: 860, lengthCapSec: 720 },
      }),
    ).toEqual({
      lead: "Upload a shorter cut of your draft.",
      detail: "",
      action: "upload_again",
    });
  });

  test("DC-FR-09, DC-FR-30 check failed on our side: the bar states only the action; the banner explains", () => {
    const failure = (retrying: boolean) => ({ kind: "ours" as const, retrying, fileName: "draft_v3.mp4" });
    expect(next({ state: "check_failed", checkFailure: failure(true) })).toEqual({
      lead: "Nothing to do right now. We’re trying the check again.",
      detail: "",
      action: null,
    });
    expect(next({ state: "check_failed", checkFailure: failure(false) })).toEqual({
      lead: "Try the check again. Your draft doesn’t need to change.",
      detail: "",
      action: "try_again",
    });
  });

  test("DC-FR-08, DC-FR-30: each file problem's bar says what to do; the banner says what is wrong", () => {
    const fileStep = (reason: "unreadable" | "format" | "not_same_video") =>
      next({ state: "check_failed", checkFailure: { kind: "file", reason, fileName: "draft_v3.mp4" } });
    expect(fileStep("unreadable")).toEqual({ lead: "Upload your draft again.", detail: "", action: "upload_again" });
    expect(fileStep("format")).toEqual({ lead: "Upload your draft as a different file type.", detail: "", action: "upload_again" });
    expect(fileStep("not_same_video")).toEqual({
      lead: "Upload the same video you put on YouTube as unlisted.",
      detail: "",
      action: "upload_again",
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
    expect(next({ state: "check_failed" })).toEqual({ lead: "Upload your draft again.", detail: "", action: "upload_again" });
  });

  test("plural wording when several items wait for the brand", () => {
    const items = [item("1", "fix_needed"), item("2", "waiting_for_brand"), item("3", "waiting_for_brand")];
    expect(next({ items }).detail).toBe(
      "2 items are waiting for Glow Theory; you can still fix them yourself. Post by 24 Oct.",
    );
  });

  test("a too-long file without its lengths still says what is wrong", () => {
    const checkFailure = { kind: "file" as const, reason: "too_long" as const, fileName: "draft_v3.mp4" };
    expect(deliverableView(deliverable({ state: "check_failed", checkFailure }), NOW).checkFailed?.body).toBe(
      "draft_v3.mp4 is longer than drafts can be.",
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

describe("DC-FR-44 deadline: one shared date, with the viewer's own time", () => {
  // 24 Oct, 23:59 in Lagos (UTC+1) is 22:59 UTC.
  const lagosDeadline = { deadline: "2026-10-24T22:59:00Z", creatorTimeZone: "Africa/Lagos" };
  const seenFrom = (timeZone: string) =>
    deliverableView(deliverable(lagosDeadline), NOW, { timeZone }).deadline;

  test("everyone reads the creator's date", () => {
    expect(seenFrom("Africa/Lagos").date).toBe("24 Oct");
    expect(seenFrom("America/New_York").date).toBe("24 Oct");
    expect(seenFrom("Asia/Tokyo").date).toBe("24 Oct");
  });

  test("adds when it ends for the viewer only when their time differs", () => {
    expect(seenFrom("Africa/Lagos").yourTime).toBeNull();
    expect(seenFrom("America/New_York").yourTime).toBe("ends 18:59 your time");
    expect(seenFrom("Asia/Tokyo").yourTime).toBe("ends 25 Oct, 07:59 your time");
  });

  test("the next step and the released message use the shared date, with the viewer's time", () => {
    const fromNewYork = deliverableView(
      deliverable({ ...lagosDeadline, items: [item("1", "waiting_for_brand")] }),
      NOW,
      { timeZone: "America/New_York" },
    );
    expect(fromNewYork.nextStep.detail).toBe("You can still upload a fix yourself. Post by 24 Oct (ends 18:59 your time).");

    const fromTokyo = deliverableView(
      deliverable({ ...lagosDeadline, state: "released", releaseReason: "deadline", releasedAt: "2026-10-25T09:00:00Z" }),
      NOW,
      { timeZone: "Asia/Tokyo" },
    );
    expect(fromTokyo.nextStep.detail).toContain("The deadline of 24 Oct passed");
  });
});

describe("DC-FR-14 to DC-FR-18 asking the brand", () => {
  const actionOf = (status: ItemStatus, extra: Partial<ChecklistItem> = {}, state: Deliverable["state"] = "results") =>
    deliverableView(deliverable({ state, items: [item("1", status, extra)] }), NOW).items[0].action;

  test("DC-FR-14: an Unsure item the API says is askable offers Ask", () => {
    expect(actionOf("unsure", { askable: true })).toBe("ask");
    expect(actionOf("unsure", { askable: false })).toBeNull();
  });

  test("DC-BR-02: a Fix needed item never offers Ask, whatever the API says", () => {
    expect(actionOf("fix_needed", { askable: true })).toBeNull();
  });

  test("DC-FR-15: a Waiting item offers Withdraw, with when it was asked", () => {
    const [waiting] = deliverableView(
      deliverable({ items: [item("1", "waiting_for_brand", { askedAt: "2026-10-06T10:00:00Z" })] }),
      NOW,
    ).items;
    expect(waiting.action).toBe("withdraw");
    expect(waiting.asked).toBe("2 hours ago");
  });

  test("DC-FR-17: a declined item can't be asked about again this run", () => {
    expect(actionOf("unsure", { askable: true, declined: true, brandNote: "Show it on skin." })).toBeNull();
  });

  test("DC-FR-10: a released deliverable offers no actions", () => {
    expect(actionOf("unsure", { askable: true }, "released")).toBeNull();
    expect(actionOf("waiting_for_brand", {}, "released")).toBeNull();
  });
});

describe("DC-FR-32 header details", () => {
  test("the run, the draft's length and the shared deadline", () => {
    const view = deliverableView(
      deliverable({ run: 2, draft: { fileName: "d.mp4", durationSec: 408, url: "/v.mp4", urlExpiresAt: "2099-01-01T00:00:00Z" } }),
      NOW,
      { timeZone: "UTC" },
    );
    expect(view.meta).toEqual(["Draft check, run 2", "6:48 long", "Post by 24 Oct"]);
  });

  test("after release, when it ended and when it was due", () => {
    expect(
      deliverableView(deliverable({ state: "released", releasedAt: "2026-10-25T09:00:00Z" }), NOW, { timeZone: "UTC" }).meta,
    ).toEqual(["Ended 25 Oct", "Was due 24 Oct"]);
  });

  test("before a draft, there is no run or length to show", () => {
    expect(deliverableView(deliverable({ state: "no_draft" }), NOW, { timeZone: "UTC" }).meta).toEqual([
      "No draft yet",
      "Post by 24 Oct",
    ]);
  });
});

describe("DC-FR-34 deal steps", () => {
  const stepsFor = (state: Deliverable["state"]) => deliverableView(deliverable({ state }), NOW).steps;

  test("seven steps; during the draft check, the first two are done and Draft check is current", () => {
    const steps = stepsFor("results");
    expect(steps.items.map((s) => s.label)).toEqual([
      "Checklist agreed",
      "Held",
      "Draft check",
      "Brand review",
      "Publish",
      "Live check",
      "Paid",
    ]);
    expect(steps.items.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(steps.summary).toBe("Step 3 of 7 · Draft check");
  });

  test("a fully passing draft is at Brand review", () => {
    expect(stepsFor("fully_passing").summary).toBe("Step 4 of 7 · Brand review");
  });

  test("a released deliverable has ended, with no current step", () => {
    const steps = stepsFor("released");
    expect(steps.items.some((s) => s.state === "current")).toBe(false);
    expect(steps.summary).toBe("Ended · hold released");
  });
});

describe("DC-FR-08, DC-FR-09, DC-FR-28 check-failed banner", () => {
  const banner = (d: Partial<Deliverable>) => deliverableView(deliverable({ state: "check_failed", run: 2, ...d }), NOW).checkFailed;

  test("a file problem: what is wrong, the hold is safe, and which results are shown", () => {
    expect(
      banner({ checkFailure: { kind: "file", reason: "too_long", fileName: "draft_v3.mp4", lengthSec: 860, lengthCapSec: 720 } }),
    ).toEqual({
      kind: "file",
      heading: "We couldn’t check draft_v3.mp4",
      body: "draft_v3.mp4 is 14:20 long, and drafts can be up to 12:00.",
      hold: "Your $1,200.00 hold is still in place",
      showing: "Below are your results from run 2.",
    });
  });

  test("each file problem says what is wrong", () => {
    const body = (reason: "unreadable" | "format" | "not_same_video") =>
      banner({ checkFailure: { kind: "file", reason, fileName: "draft_v3.mp4" } })?.body;
    expect(body("unreadable")).toBe("We couldn’t read draft_v3.mp4; the file may be damaged.");
    expect(body("format")).toBe("We can’t check draft_v3.mp4 in this format.");
    expect(body("not_same_video")).toBe("draft_v3.mp4 doesn’t match your unlisted YouTube upload.");
  });

  test("our side: not the creator's fault", () => {
    expect(banner({ checkFailure: { kind: "ours", retrying: true, fileName: "draft_v3.mp4" } })).toMatchObject({
      kind: "ours",
      heading: "Something went wrong on our side checking draft_v3.mp4",
      body: "It isn’t a problem with your video. We’re trying again; you don’t need to do anything.",
    });
  });

  test("no banner outside the check-failed state", () => {
    expect(deliverableView(deliverable(), NOW).checkFailed).toBeNull();
  });
});

describe("DC-FR-04 check stages", () => {
  test("while checking, the stages and how far along the check is", () => {
    const view = deliverableView(
      deliverable({
        state: "checking",
        run: 3,
        checkStartedAt: "2026-10-06T11:58:00Z",
        stages: [
          { name: "Reading what’s said", status: "done" },
          { name: "Watching the video", status: "current" },
          { name: "Checking each item", status: "waiting" },
        ],
        items: [item("1", "passed"), item("2", "checking"), item("3", "at_live_check")],
      }),
      NOW,
    );
    expect(view.checking).toEqual({
      meta: "Run 3 · started 2 minutes ago · 1 of 2 items done",
      stages: [
        { name: "Reading what’s said", status: "done" },
        { name: "Watching the video", status: "current" },
        { name: "Checking each item", status: "waiting" },
      ],
    });
  });

  test("no stages panel when the API sends no stages, or outside a check", () => {
    expect(deliverableView(deliverable({ state: "checking" }), NOW).checking).toBeNull();
    expect(deliverableView(deliverable(), NOW).checking).toBeNull();
  });
});

describe("fully passing moment", () => {
  test("counts the items that passed the draft check (live-check items come later)", () => {
    const view = deliverableView(
      deliverable({
        state: "fully_passing",
        items: [item("1", "passed"), item("2", "accepted_by_brand"), item("3", "passed"), item("4", "at_live_check")],
      }),
      NOW,
    );
    expect(view.passed).toEqual({ count: 3, statuses: ["passed", "accepted_by_brand", "passed"], fixed: null });
  });

  test("only when fully passing", () => {
    expect(deliverableView(deliverable(), NOW).passed).toBeNull();
  });

  test("DC-FR-46: an item's suggested fix shows only while the item still needs the creator", () => {
    const hint = "Change the on-screen code to GLOW20, with a zero.";
    const statuses: ItemStatus[] = ["fix_needed", "unsure", "waiting_for_brand", "passed", "accepted_by_brand", "checking", "not_checked", "at_live_check"];
    const view = deliverableView(deliverable({ items: statuses.map((s) => item(s, s, { fixHint: hint })) }), NOW);
    const shown = Object.fromEntries(view.items.map((i) => [i.status, i.suggestedFix]));
    expect(shown).toEqual({
      fix_needed: hint,
      unsure: hint,
      waiting_for_brand: hint,
      passed: null,
      accepted_by_brand: null,
      checking: null,
      not_checked: null,
      at_live_check: null,
    });
    expect(deliverableView(deliverable({ items: [item("a", "fix_needed")] }), NOW).items[0].suggestedFix).toBeNull();
  });
});

describe("DC-FR-48 what the new run changed", () => {
  const change = (items: ChecklistItem[], extra: Partial<Deliverable> = {}) =>
    deliverableView(deliverable({ run: 3, items, ...extra }), NOW).runChange;
  const was = (id: string, status: ItemStatus, previousStatus: ItemStatus) => item(id, status, { previousStatus, name: `Item ${id}` });

  test("something fixed and nothing worse: your fix worked, by name, with what still needs you", () => {
    expect(change([was("a", "passed", "fix_needed"), item("b", "unsure"), item("c", "passed")])).toEqual({
      heading: "Your fix worked",
      tone: "pass",
      lines: ["Item a now passes."],
      stillNeedsYou: "1 item still needs you.",
      showing: "Below are your results from run 3.",
    });
  });

  test("fixed and worse: both said plainly", () => {
    expect(change([was("a", "passed", "fix_needed"), was("b", "fix_needed", "passed"), was("c", "unsure", "passed")])).toMatchObject({
      heading: "Your fix worked, but something changed",
      tone: "neutral",
      lines: ["Item a now passes.", "Item b passed before and now needs fixing.", "Item c passed before and is now unsure."],
      stillNeedsYou: "2 items still need you.",
    });
  });

  test("nothing fixed: something changed in this draft", () => {
    expect(change([was("a", "fix_needed", "unsure")])).toMatchObject({
      heading: "Something changed in this draft",
      tone: "neutral",
      lines: ["Item a was unsure and now needs fixing."],
    });
  });

  test("an acceptance the new draft cancelled says why the item is unsure again", () => {
    expect(change([was("a", "unsure", "accepted_by_brand")])?.lines).toEqual([
      "Glow Theory’s acceptance of Item a was cancelled by the new draft, so it’s unsure again.",
    ]);
  });

  test("names up to three items, then how many more", () => {
    const items = ["a", "b", "c", "d", "e"].map((id) => was(id, "passed", "fix_needed"));
    expect(change(items)?.lines).toEqual(["Item a, Item b, Item c and 2 more now pass."]);
    expect(change(items.slice(0, 2))?.lines).toEqual(["Item a and Item b now pass."]);
  });

  test("no summary on run 1, when nothing changed, or outside the results state", () => {
    expect(change([was("a", "passed", "fix_needed")], { run: 1 })).toBeNull();
    expect(change([item("a", "passed"), was("b", "unsure", "unsure")])).toBeNull();
    expect(change([was("a", "passed", "fix_needed")], { state: "fully_passing" })).toBeNull();
  });

  test("fully passing after a fix: one line on the passed banner instead", () => {
    const view = deliverableView(deliverable({ state: "fully_passing", run: 3, items: [was("a", "passed", "fix_needed"), item("b", "passed")] }), NOW);
    expect(view.passed?.fixed).toBe("Your fix worked: Item a now passes.");
    const first = deliverableView(deliverable({ state: "fully_passing", run: 1, items: [item("a", "passed")] }), NOW);
    expect(first.passed?.fixed).toBeNull();
  });
});

describe("DC-FR-20, DC-FR-10 tabs once released", () => {
  test("a released deliverable has no Needs you tab; its items stay under All", () => {
    const items = [item("a", "fix_needed"), item("b", "unsure"), item("c", "passed")];
    const tabs = deliverableView(deliverable({ state: "released", items }), NOW).tabs;
    expect(tabs.map((t) => t.id)).not.toContain("needs_you");
    expect(tabs.find((t) => t.id === "all")?.count).toBe(3);
    expect(deliverableView(deliverable({ items }), NOW).tabs.map((t) => t.id)).toContain("needs_you");
  });
});

