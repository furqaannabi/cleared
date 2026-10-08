import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "@/lib/api";
import { endBrandWait, setDemoGoAhead, setDemoLiveCheck, setDemoPayout } from "@/mocks/demo-publish";

const DEAL = "deal_juniper";
const SHORT = "del_juniper_short"; // approved, a YouTube Short
const SETTLE_MS = 4000; // the mock's live check and payout take a few seconds

afterEach(() => vi.useRealTimers());

const creator = async (id = SHORT) => {
  const r = await api.getDeliverable(id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const brand = async (id = SHORT) => {
  const r = await api.getBrandDeliverable(DEAL, id);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
/** Approved → go-ahead → posted, then the live check's demo result lands. */
async function postAndCheck(live: Parameters<typeof setDemoLiveCheck>[0]) {
  await api.getGoAhead(SHORT);
  await setDemoLiveCheck(live);
  await api.markPosted(SHORT);
  vi.useFakeTimers({ now: Date.now() + SETTLE_MS, toFake: ["Date"] });
}

describe("PP-FR-01 to PP-FR-05 the go-ahead", () => {
  test("a go-ahead: post before a stated time, never past the deadline; the brand sees the creator posting", async () => {
    const r = await api.getGoAhead(SHORT);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.state).toBe("posting");
    expect(r.data.goAhead?.state).toBe("go");
    const ends = r.data.goAhead?.state === "go" ? Date.parse(r.data.goAhead.endsAt) : 0;
    expect(ends).toBeLessThanOrEqual(Math.min(Date.now() + 48 * 3_600_000, Date.parse(r.data.deadline)) + 1000);
    await api.openBrandLink("demo_juniper");
    expect((await brand()).review.state).toBe("posting");
  });

  test("wait until, and not confirmed: no go-ahead; asking again before the wait is over is refused", async () => {
    await setDemoGoAhead("wait");
    const waited = await api.getGoAhead(SHORT);
    expect(waited.ok && waited.data).toMatchObject({ state: "approved", goAhead: { state: "wait" } });
    expect(await api.getGoAhead(SHORT)).toEqual({ ok: false, error: "rejected" });
  });

  test("not confirmed: don't post; the creator can ask again", async () => {
    await setDemoGoAhead("not_confirmed");
    expect((await api.getGoAhead(SHORT)).ok && (await creator()).goAhead).toEqual({ state: "not_confirmed" });
    expect((await api.getGoAhead(SHORT)).ok).toBe(true);
  });

  test("PP-FR-05: a go-ahead that runs out with no post ends; the creator asks again", async () => {
    await api.getGoAhead(SHORT);
    vi.useFakeTimers({ now: Date.now() + 49 * 3_600_000, toFake: ["Date"] });
    expect(await creator()).toMatchObject({ state: "approved", goAhead: { state: "ended" } });
  });
});

describe("PP-FR-06 to PP-FR-15 posting and the live check", () => {
  test("I've posted it is refused without a go-ahead; a Reel needs its own link", async () => {
    expect(await api.markPosted(SHORT)).toEqual({ ok: false, error: "rejected" });
    await api.openBrandLink("demo_juniper");
    await api.acceptItem(DEAL, "del_juniper_reel", "jr_1");
    await api.approveDraft(DEAL, "del_juniper_reel");
    await api.getGoAhead("del_juniper_reel");
    expect(await api.markPosted("del_juniper_reel")).toEqual({ ok: false, error: "rejected" });
    expect(await api.markPosted("del_juniper_reel", "https://evil.example/reel/1")).toEqual({ ok: false, error: "rejected" });
    expect((await api.markPosted("del_juniper_reel", "https://www.instagram.com/reel/C9xT2abc/")).ok).toBe(true);
  });

  test("posting starts the live check; the At live check items are checking", async () => {
    await api.getGoAhead(SHORT);
    const r = await api.markPosted(SHORT);
    if (!r.ok) throw new Error(r.error);
    expect(r.data).toMatchObject({ state: "published", liveCheck: { state: "checking" } });
    expect(r.data.items.find((i) => i.id === "js_3")?.status).toBe("checking");
  });

  test("passed: each live item passes with evidence; the hold is captured with the fee, then paid", async () => {
    await postAndCheck("passed");
    const captured = await creator();
    expect(captured.items.find((i) => i.id === "js_3")).toMatchObject({ status: "passed" });
    expect(captured).toMatchObject({ state: "captured", capture: { amount: "350.00", fee: "17.50", payout: "332.50" }, payout: { state: "sending" } });
    vi.setSystemTime(Date.now() + SETTLE_MS);
    expect(await creator()).toMatchObject({ state: "paid", payout: { state: "paid" }, hold: { stage: "paid" } });
  });

  test("fixable: the item to fix, a fix window, and Check again; the window ending releases the hold", async () => {
    await postAndCheck("fixable");
    const d = await creator();
    expect(d.liveCheck?.state).toBe("fixable");
    expect(d.items.find((i) => i.id === "js_3")?.status).toBe("fix_needed");
    vi.useRealTimers();
    await setDemoLiveCheck("passed");
    expect((await api.checkLiveAgain(SHORT)).ok).toBe(true);
    await setDemoLiveCheck("fixable");
  });

  test("the fix window ending releases the hold with that reason", async () => {
    await postAndCheck("fixable");
    await creator();
    vi.setSystemTime(Date.now() + 30 * 86_400_000);
    expect(await creator()).toMatchObject({ state: "released", releaseReason: "fix_window_ended" });
  });

  test("undecided: the brand has 48 hours to confirm; silence pays", async () => {
    await postAndCheck("undecided");
    await api.openBrandLink("demo_juniper");
    expect((await brand()).review).toMatchObject({ state: "confirm", what: "the paid promotion label" });
    vi.useRealTimers();
    expect(await endBrandWait(SHORT)).toBe(true);
    const d = await creator();
    expect(d.state).toBe("captured");
    expect(d.items.find((i) => i.id === "js_3")?.status).toBe("accepted_by_brand");
  });

  test("undecided: the brand confirms, which captures; or objects with a reason, which goes to Cleared", async () => {
    await postAndCheck("undecided");
    await api.openBrandLink("demo_juniper");
    vi.useRealTimers();
    expect(await api.objectToPost(DEAL, SHORT, "  ")).toEqual({ ok: false, error: "rejected" });
    const objected = await api.objectToPost(DEAL, SHORT, "The label isn’t on.");
    expect(objected.ok && objected.data.review).toMatchObject({ state: "with_cleared", reason: "The label isn’t on." });
    expect((await api.confirmPost(DEAL, SHORT)).ok).toBe(false);
  });

  test("not fixable: the brand may accept it, which captures; silence releases the hold", async () => {
    await postAndCheck("not_fixable");
    await api.openBrandLink("demo_juniper");
    expect((await brand()).review.state).toBe("accept");
    vi.useRealTimers();
    const accepted = await api.acceptPost(DEAL, SHORT);
    expect(accepted.ok && accepted.data.review).toMatchObject({ state: "taken", amount: "350.00", creatorPaid: false });
  });

  test("not fixable, and the brand says nothing: released, not accepted", async () => {
    await postAndCheck("not_fixable");
    expect((await creator()).liveCheck?.state).toBe("not_fixable");
    vi.useRealTimers();
    await endBrandWait(SHORT);
    expect(await creator()).toMatchObject({ state: "released", releaseReason: "not_accepted" });
  });
});

describe("PP-FR-19, PP-FR-20, PP-BR-04 payout problems", () => {
  test("unclaimed: the creator can send it again, which pays", async () => {
    await setDemoPayout("unclaimed");
    await postAndCheck("passed");
    await creator();
    vi.setSystemTime(Date.now() + SETTLE_MS);
    expect(await creator()).toMatchObject({ state: "captured", payout: { state: "unclaimed", canSendAgain: true } });
    vi.useRealTimers();
    await setDemoPayout("paid");
    expect((await api.sendPayoutAgain(SHORT)).ok).toBe(true);
    expect((await api.sendPayoutAgain(SHORT)).ok).toBe(false);
  });

  test("the brand sees what was taken, never the payout email or its problems", async () => {
    await setDemoPayout("failed");
    await postAndCheck("passed");
    await creator();
    vi.setSystemTime(Date.now() + SETTLE_MS);
    expect((await creator()).payout?.state).toBe("failed");
    await api.openBrandLink("demo_juniper");
    const b = await brand();
    expect(b.review).toMatchObject({ state: "taken", amount: "350.00", creatorPaid: false });
    expect(JSON.stringify(b)).not.toContain("ada@example.com");
  });
});

describe("PP-FR-24, PP-FR-32 the deals list and the seeded paid post", () => {
  test("a paid post is seeded with every reference", async () => {
    const d = await creator("del_wren_video");
    expect(d).toMatchObject({ state: "paid", capture: { amount: "800.00", fee: "40.00", payout: "760.00" }, payout: { state: "paid" } });
    expect(d.capture?.reference && d.payout?.reference && d.hold.reference).toBeTruthy();
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.find((x) => x.id === "deal_wren")).toMatchObject({ status: "Paid" });
  });

  test("a held deal's line follows its posts after Approved", async () => {
    await api.getGoAhead(SHORT);
    const deals = await api.getDeals();
    const juniper = deals.ok ? deals.data.find((x) => x.id === DEAL) : undefined;
    expect(juniper?.deliverables.find((x) => x.id === SHORT)?.state).toBe("posting");
    expect(juniper).toMatchObject({ openDeliverableId: SHORT, status: "Ready to post" });
  });
});
