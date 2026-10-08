import { describe, expect, test } from "vitest";
import type { BrandDeliverable, BrandItem } from "./types";
import { brandReviewView } from "./review-view";

const NOW = new Date("2026-10-08T12:00:00Z");

const item = (id: string, status: BrandItem["status"], extra: Partial<BrandItem> = {}): BrandItem => ({
  id,
  name: `Item ${id}`,
  kind: "said",
  checkedBy: "ai_timestamp",
  status,
  briefLine: { number: 1, text: "A brief line." },
  ...extra,
});

const deliverable = (review: BrandDeliverable["review"], items: BrandItem[] = [item("a", "passed")]): BrandDeliverable => ({
  dealId: "deal_1",
  deliverableId: "del_1",
  creatorName: "Ada Okafor",
  brandName: "Juniper & Salt",
  platform: "youtube_video",
  creatorTimeZone: "UTC",
  hold: { amount: "1500.00", reference: "DEMO-1", deadline: "2026-10-23T23:59:00Z" },
  review,
  ...(review.state === "nothing_yet" ? {} : { draft: { url: "/v.mp4", urlExpiresAt: "2099-01-01T00:00:00Z", durationSec: 60, items } }),
});

const view = (d: BrandDeliverable, now = NOW) => brandReviewView(d, now, { timeZone: "UTC" });

describe("RW-FR-15 the window", () => {
  test("says how long is left and until when, that silence approves, and offers approve and object", () => {
    const v = view(deliverable({ state: "window", endsAt: "2026-10-09T19:12:00Z" }));
    expect(v.state).toBe("window");
    expect(v.next).toEqual({ lead: "Every item passed. You have until Fri 9 Oct, 19:12 to review.", detail: "If you say nothing, the draft is approved." });
    expect(v.timeLeft).toEqual({ text: "31h 12m", lastHour: false });
    expect(v.actions).toMatchObject({ approve: true, object: true, answer: false, approveAnyway: false });
  });

  test("RW-FR-19: in the last hour the time left leads, with a warning", () => {
    const v = view(deliverable({ state: "window", endsAt: "2026-10-08T12:42:00Z" }));
    expect(v.timeLeft).toEqual({ text: "42m", lastHour: true });
    expect(v.warning).toBe("Less than an hour left to object.");
  });
});

describe("RW-FR-06, RW-FR-12, RW-FR-21 to RW-FR-24 the other states", () => {
  test("nothing yet: Ada is working on it; no actions", () => {
    const v = view(deliverable({ state: "nothing_yet" }));
    expect(v.next).toEqual({ lead: "Ada Okafor is working on the draft.", detail: "You’ll get a link when there’s something to review." });
    expect(Object.values(v.actions).some(Boolean)).toBe(false);
  });

  test("asked: names how many items, and that nothing else needs the brand yet; the answers are on", () => {
    const v = view(deliverable({ state: "asked" }, [item("a", "fix_needed"), item("b", "asked"), item("c", "asked")]));
    expect(v.next).toEqual({ lead: "Ada Okafor asked you to accept 2 items.", detail: "Nothing else needs you until every item passes." });
    expect(v.actions).toMatchObject({ approve: false, object: false, answer: true, approveAnyway: false });
  });

  test("asked, all answered: Ada is working on the rest", () => {
    const v = view(deliverable({ state: "asked" }, [item("a", "fix_needed"), item("b", "accepted")]));
    expect(v.next.lead).toBe("You answered Ada Okafor.");
    expect(v.actions.answer).toBe(false);
  });

  test("objected: the clock has stopped, the new-draft date and what happens if none comes; only approve anyway", () => {
    const v = view(deliverable({ state: "objected", objectedAt: "2026-10-08T10:00:00Z" }, [item("a", "objected", { note: "Slower." }), item("b", "objected"), item("c", "passed")]));
    expect(v.next).toEqual({
      lead: "You asked Ada Okafor to fix 2 items.",
      detail: "The clock has stopped. Ada Okafor makes a new draft by 23 Oct; if Ada Okafor doesn’t, the hold comes back to you.",
    });
    expect(v.actions).toMatchObject({ approve: false, object: false, answer: false, approveAnyway: true });
  });

  test("approved by the brand or by the window: who posts next, and when the money is taken", () => {
    const byYou = view(deliverable({ state: "approved", approvedAt: "2026-10-08T09:00:00Z", by: "brand" }));
    expect(byYou.next).toEqual({ lead: "Approved by you · 8 Oct", detail: "Ada Okafor posts by 23 Oct. Your $1,500.00 is taken only once the live post checks out." });
    expect(view(deliverable({ state: "approved", approvedAt: "2026-10-08T09:00:00Z", by: "window" })).next.lead).toBe("Approved · No objection in 48 hours");
    expect(Object.values(byYou.actions).some(Boolean)).toBe(false);
  });

  test("released: the hold came back, when and why", () => {
    const v = view(deliverable({ state: "released", releasedAt: "2026-10-24T00:10:00Z", reason: "deadline" }));
    expect(v.next).toEqual({ lead: "The hold came back to you.", detail: "Ada Okafor didn’t post by the deadline, so your $1,500.00 was released on 24 Oct." });
  });
});

describe("RW-FR-08 statuses, worded for the brand", () => {
  test("each item's word; the icons and colours are the creator's own", () => {
    const v = view(
      deliverable({ state: "asked" }, [
        item("1", "passed"),
        item("2", "fix_needed"),
        item("3", "unsure"),
        item("4", "at_live_check"),
        item("5", "asked"),
        item("6", "accepted"),
        item("7", "fix_requested"),
        item("8", "objected"),
      ]),
    );
    expect(v.items.map((i) => i.status.label)).toEqual([
      "Passed",
      "Ada Okafor is fixing this",
      "Unsure",
      "At live check",
      "Ada Okafor asked you",
      "You accepted",
      "You asked for a fix",
      "You objected",
    ]);
    expect(v.items.filter((i) => i.status.tone === "pass").map((i) => i.id)).toEqual(["1"]);
    expect(v.items.find((i) => i.id === "6")?.status).toMatchObject({ icon: "check-circle", tone: "accepted" });
    expect(v.items.find((i) => i.id === "8")?.status).toMatchObject({ icon: "flag", tone: "fail" });
  });

  test("RW-FR-12: an item asked about is selected first, then an objected one, else the first", () => {
    expect(view(deliverable({ state: "asked" }, [item("a", "passed"), item("b", "asked")])).selectedId).toBe("b");
    expect(view(deliverable({ state: "objected", objectedAt: "2026-10-08T10:00:00Z" }, [item("a", "passed"), item("b", "objected")])).selectedId).toBe("b");
    expect(view(deliverable({ state: "window", endsAt: "2026-10-09T19:12:00Z" }, [item("a", "passed"), item("b", "passed")])).selectedId).toBe("a");
    expect(view(deliverable({ state: "nothing_yet" })).selectedId).toBeNull();
  });
});

describe("PP-FR-25 to PP-FR-31 after the draft is approved", () => {
  test("posting and checking: who acts next; no actions", () => {
    expect(view(deliverable({ state: "posting", postBy: "2026-10-10T14:00:00Z" })).next).toEqual({
      lead: "Ada Okafor has the go-ahead to post.",
      detail: "They post by Sat 10 Oct, 14:00. Your money is taken only once the live post checks out.",
    });
    expect(view(deliverable({ state: "live_check" })).next.lead).toBe("Checking the live post.");
  });

  test("confirm: why, until when, and that silence pays; confirm and object are on", () => {
    const v = view(deliverable({ state: "confirm", endsAt: "2026-10-10T14:00:00Z", what: "the paid promotion label" }));
    expect(v.next).toEqual({
      lead: "Confirm the post",
      detail: "We couldn’t check the paid promotion label automatically. Look at the live post. If you say nothing by Sat 10 Oct, 14:00, Ada Okafor is paid.",
    });
    expect(v.timeLeft).toEqual({ text: "50h 0m", lastHour: false });
    expect(v.actions).toMatchObject({ confirmPost: true, acceptPost: false });
  });

  test("accept: what failed, and that silence returns the money", () => {
    const v = view(deliverable({ state: "accept", endsAt: "2026-10-10T08:00:00Z", reason: "It’s a different cut." }));
    expect(v.next).toEqual({
      lead: "Accept the post anyway?",
      detail: "It’s a different cut. If you don’t accept it by Sat 10 Oct, 08:00, the hold comes back to you.",
    });
    expect(v.actions).toMatchObject({ confirmPost: false, acceptPost: true });
  });

  test("with Cleared, taken, capture refused, approved not paid", () => {
    expect(view(deliverable({ state: "with_cleared", reason: "No label.", ruleBy: "2026-10-14T12:00:00Z" })).next).toEqual({
      lead: "A person at Cleared is deciding",
      detail: "You objected: “No label.” We decide by 14 Oct. Your money stays held until then.",
    });
    expect(view(deliverable({ state: "taken", amount: "1500.00", reference: "DEMO-CAP", at: "2026-10-09T10:00:00Z", creatorPaid: true })).next).toEqual({
      lead: "Paid",
      detail: "Your $1,500.00 was taken on 9 Oct · PayPal ref DEMO-CAP. Ada Okafor was paid.",
    });
    expect(view(deliverable({ state: "taken", amount: "1500.00", reference: "DEMO-CAP", at: "2026-10-09T10:00:00Z", creatorPaid: false })).next.detail).toBe(
      "Your $1,500.00 was taken on 9 Oct · PayPal ref DEMO-CAP. Ada Okafor’s payment is on its way.",
    );
    expect(view(deliverable({ state: "capture_refused", retryUntil: "2026-10-30T10:00:00Z" })).next.detail).toBe(
      "Your payment for this post failed at PayPal. Check your PayPal funding; we try again until 30 Oct.",
    );
    expect(view(deliverable({ state: "approved_not_paid" })).next.lead).toBe("Approved, not paid");
  });

  test("PP-FR-31: the brand's release reasons", () => {
    const why = (reason: "not_accepted" | "fix_window_ended" | "ruled_not_to_pay") =>
      view(deliverable({ state: "released", releasedAt: "2026-10-24T00:10:00Z", reason })).next.detail;
    expect(why("not_accepted")).toBe("You didn’t accept the post within 48 hours, so your $1,500.00 came back to you on 24 Oct.");
    expect(why("fix_window_ended")).toBe("Ada Okafor didn’t fix the live post in time, so your $1,500.00 came back to you on 24 Oct.");
    expect(why("ruled_not_to_pay")).toBe("A person at Cleared decided not to pay, so your $1,500.00 came back to you on 24 Oct.");
  });
});
