import { describe, expect, test } from "vitest";
import type { Deliverable } from "@/lib/deliverable/types";
import { journey } from "./journey";

const NOW = new Date("2026-10-08T12:00:00Z");
const base = (o: Partial<Deliverable>): Deliverable => ({
  id: "del_1",
  brandName: "Juniper & Salt",
  platform: "youtube_short",
  state: "approved",
  approvedAt: "2026-10-07T10:00:00Z",
  approvedBy: "brand",
  deadline: "2026-10-20T22:59:00Z",
  creatorTimeZone: "UTC",
  items: [],
  hold: { amountMinor: 35000, currency: "USD", reference: "DEMO-H", heldAt: "2026-10-05T10:00:00Z", stage: "held" },
  payoutEmail: "ada@example.com",
  ...o,
});
const j = (o: Partial<Deliverable>) => journey(base(o), NOW, { timeZone: "UTC" });
const now = (o: Partial<Deliverable>) => j(o).steps.find((s) => s.state === "now" || s.state === "problem")!;

describe("PP-FR-01 to PP-FR-05 the go-ahead", () => {
  test("approved: the amount held, the draft approved, and Get the go-ahead", () => {
    const v = j({});
    expect(v).toMatchObject({ heading: "Held in PayPal for this Short", amount: "$350.00" });
    expect(v.steps.map((s) => [s.title, s.state])).toEqual([
      ["Draft approved", "done"],
      ["Ready to post?", "now"],
      ["Posted", "todo"],
      ["Live check", "todo"],
      ["Captured", "todo"],
      ["Paid", "todo"],
    ]);
    expect(v.action).toEqual({ kind: "get_go_ahead", label: "Get the go-ahead", disabled: false });
  });

  test("posting: you can post now, before when, a countdown, and I've posted it", () => {
    const step = now({ state: "posting", goAhead: { state: "go", endsAt: "2026-10-10T11:12:00Z" } });
    expect(step).toMatchObject({ title: "You can post now", countdown: { text: "47h 12m", lastHour: false } });
    expect(step.body).toBe("Post before Sat 10 Oct, 11:12. If you forget to tap, we check your channel when your go-ahead ends.");
    expect(j({ state: "posting", goAhead: { state: "go", endsAt: "2026-10-10T11:12:00Z" } }).action).toMatchObject({ kind: "posted", label: "I’ve posted it" });
  });

  test("wait until, not confirmed, and a go-ahead that ended", () => {
    expect(now({ goAhead: { state: "wait", until: "2026-10-08T18:00:00Z" } })).toMatchObject({ title: "Wait until Thu 8 Oct, 18:00", state: "now" });
    expect(j({ goAhead: { state: "wait", until: "2026-10-08T18:00:00Z" } }).action).toMatchObject({ disabled: true });
    const no = now({ goAhead: { state: "not_confirmed" } });
    expect(no).toMatchObject({ title: "Don’t post yet", state: "problem" });
    expect(j({ goAhead: { state: "not_confirmed" } }).action?.label).toBe("Ask again");
    expect(now({ goAhead: { state: "ended" } }).title).toBe("Your go-ahead ended");
  });
});

describe("PP-FR-09 to PP-FR-15 the live check", () => {
  const posted = { state: "published" as const, post: { url: "https://www.youtube.com/watch?v=abc", publishedAt: "2026-10-08T11:00:00Z" } };
  test("checking, then each result", () => {
    expect(now({ ...posted, liveCheck: { state: "checking" } }).title).toBe("Checking your live post…");
    const fix = now({ ...posted, liveCheck: { state: "fixable", fixBy: "2026-10-10T14:00:00Z" }, items: [{ id: "a", name: "Marked as a paid promotion", kind: "disclosure", status: "fix_needed", checkedBy: "published_post" }] });
    expect(fix).toMatchObject({ title: "1 item to fix on your live post", state: "problem" });
    expect(fix.body).toBe("Fix Marked as a paid promotion and check again before Sat 10 Oct, 14:00.");
    expect(now({ ...posted, liveCheck: { state: "undecided", what: "the paid promotion label", brandBy: "2026-10-10T14:00:00Z" } }).body).toBe(
      "We couldn’t check the paid promotion label automatically. Juniper & Salt has until Sat 10 Oct, 14:00 to confirm. If they say nothing, you’re paid. If they object, a person at Cleared decides.",
    );
    expect(now({ ...posted, liveCheck: { state: "not_fixable", reason: "It’s a different cut.", brandBy: "2026-10-10T14:00:00Z" } }).body).toBe(
      "It’s a different cut. Juniper & Salt has until Sat 10 Oct, 14:00 to accept it anyway. If they don’t, the hold goes back to them.",
    );
    expect(now({ ...posted, liveCheck: { state: "objected", reason: "No label.", ruleBy: "2026-10-13T12:00:00Z" } })).toMatchObject({ title: "A person at Cleared is deciding" });
  });

  test("the posted step links to the post", () => {
    expect(j({ ...posted, liveCheck: { state: "checking" } }).steps.find((s) => s.title === "Posted")).toMatchObject({ state: "done", link: { href: "https://www.youtube.com/watch?v=abc", label: "View your post" } });
  });
});

describe("PP-FR-16 to PP-FR-23 money", () => {
  const cap = { reference: "DEMO-CAP", at: "2026-10-09T10:00:00Z", amount: "350.00", fee: "17.50", payout: "332.50" };
  test("captured: the API's figures, never the page's; sending", () => {
    const v = j({ state: "captured", liveCheck: { state: "passed" }, capture: cap, payout: { state: "sending", email: "ada@example.com", canSendAgain: false } });
    expect(v).toMatchObject({ heading: "Captured from Juniper & Salt", amount: "$350.00" });
    expect(v.steps.find((s) => s.title === "Captured")?.meta).toBe("9 Oct · PayPal ref DEMO-CAP · less Cleared’s 5% fee, $17.50");
    expect(now({ state: "captured", capture: cap, payout: { state: "sending", email: "ada@example.com", canSendAgain: false } }).title).toBe("Sending $332.50 to ada@example.com");
  });

  test("unclaimed and failed offer Send it again only when the API allows; failed asks for the email", () => {
    const un = j({ state: "captured", capture: cap, payout: { state: "unclaimed", email: "ada@example.com", canSendAgain: true } });
    expect(un.action).toMatchObject({ kind: "send_again", label: "Send it again" });
    expect(un.steps.find((s) => s.state === "problem")?.title).toBe("PayPal is holding $332.50 for ada@example.com");
    const failed = j({ state: "captured", capture: cap, payout: { state: "failed", email: "ada@exmaple.com", reason: "No account at that email.", canSendAgain: true } });
    expect(failed.action).toMatchObject({ kind: "send_again", fixEmail: true });
    expect(j({ state: "captured", capture: cap, payout: { state: "failed", email: "a@b.co", canSendAgain: false } }).action).toBeNull();
  });

  test("PP-FR-35: a payout PayPal won't send is delayed on Cleared's side, current, with nothing to do", () => {
    const v = j({ state: "captured", capture: cap, payout: { state: "delayed", email: "ada@example.com", canSendAgain: false } });
    expect(v).toMatchObject({ heading: "Captured from Juniper & Salt", action: null });
    expect(v.steps.find((s) => s.key === "paid")).toMatchObject({
      state: "now",
      title: "Sending $332.50 to ada@example.com is delayed",
      body: "The delay is on Cleared’s side, with our PayPal account. Your money is safe with Cleared, and we keep trying until it’s sent. There’s nothing you need to do.",
    });
  });

  test("PP-FR-36: an unclaimed payout being cancelled reads as sending again, with nothing to do", () => {
    const v = j({ state: "captured", capture: cap, payout: { state: "cancelling", email: "ada@example.com", canSendAgain: false } });
    expect(v.action).toBeNull();
    expect(v.steps.find((s) => s.key === "paid")).toMatchObject({
      state: "now",
      title: "Sending $332.50 again",
      body: "PayPal is cancelling the unclaimed payment first, then we send it to ada@example.com.",
    });
  });

  test("paid: Cleared, every step done, the payout reference", () => {
    const v = j({ state: "paid", capture: cap, payout: { state: "paid", email: "ada@example.com", reference: "DEMO-PAY", at: "2026-10-10T09:00:00Z", canSendAgain: false } });
    expect(v).toMatchObject({ heading: "Cleared", amount: "$332.50", action: null });
    expect(v.steps.every((s) => s.state === "done")).toBe(true);
    expect(v.steps.at(-1)).toMatchObject({ title: "Paid $332.50 to ada@example.com", meta: "10 Oct · Payout ref DEMO-PAY · after Cleared’s 5% fee" });
  });

  test("capture refused and approved, not paid", () => {
    expect(now({ state: "published", liveCheck: { state: "passed" }, captureRefused: { retryUntil: "2026-10-30T10:00:00Z" } }).body).toBe(
      "Approved. PayPal couldn’t take Juniper & Salt’s payment yet. We try again until 30 Oct and have told Juniper & Salt.",
    );
    const anp = j({ state: "approved_not_paid" });
    expect(anp.heading).toBe("Approved, not paid");
    expect(anp.steps.find((s) => s.state === "problem")?.body).toBe(
      "This post was approved, but PayPal never let Cleared collect Juniper & Salt’s payment, so you weren’t paid through Cleared.",
    );
  });
});

describe("PP-FR-16 the money header (DESIGN.md \"Money card\" carried to Paid)", () => {
  const cap = { reference: "DEMO-CAP", at: "2026-10-09T10:00:00Z", amount: "350.00", fee: "17.50", payout: "332.50" };
  test("held: marigold, the hold's reference and date", () => {
    expect(j({})).toMatchObject({ tone: "money", heading: "Held in PayPal for this Short", reference: "Ref DEMO-H · held 5 Oct" });
  });
  test("captured: marigold, the capture's reference and date", () => {
    const v = j({ state: "captured", capture: cap, payout: { state: "sending", email: "ada@example.com", canSendAgain: false } });
    expect(v).toMatchObject({ tone: "money", reference: "PayPal ref DEMO-CAP · 9 Oct" });
  });
  test("paid: cleared, where it was paid and when", () => {
    const v = j({ state: "paid", capture: cap, payout: { state: "paid", email: "ada@example.com", reference: "DEMO-PAY", at: "2026-10-10T09:00:00Z", canSendAgain: false } });
    expect(v).toMatchObject({ tone: "cleared", heading: "Cleared", reference: "Paid to ada@example.com · 10 Oct" });
  });
  test("approved, not paid: the money stopped moving towards the creator", () => {
    expect(j({ state: "approved_not_paid" }).tone).toBe("stopped");
  });
});

