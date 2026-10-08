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
    expect(v.actions).toEqual({ approve: true, object: true, answer: false, approveAnyway: false });
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
    expect(v.actions).toEqual({ approve: false, object: false, answer: true, approveAnyway: false });
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
    expect(v.actions).toEqual({ approve: false, object: false, answer: false, approveAnyway: true });
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
