import { describe, expect, test } from "vitest";
import { dealGroups, type DealSummary } from "./deal-groups";
import { aPayment } from "./test-rows";

const deal = (id: string, states: DealSummary["deliverables"][number]["state"][], d: Partial<DealSummary> = {}): DealSummary => ({
  id,
  brandName: id,
  status: "Status line",
  step: "agreed",
  deliverables: states.map((state, i) => ({ id: `${id}_${i}`, platform: "youtube_video", state })),
  ...d,
});

describe("HM-FR-15 deals, with what needs the creator first", () => {
  test("posts waiting on the creator put the deal under Needs you; finished deals go last", () => {
    const g = dealGroups(
      [deal("paid", ["paid", "released"]), deal("review", ["fully_passing", "checking"]), deal("fix", ["check_failed"]), deal("go", ["published", "approved"])],
      [],
    );
    expect(g.map((x) => [x.name, x.deals.map((d) => d.brandName)])).toEqual([
      ["Needs you", ["fix", "go"]],
      ["Under way", ["review"]],
      ["Finished", ["paid"]],
    ]);
  });

  test.each(["no_draft", "check_failed", "results", "objected", "approved"] as const)("a post at %s needs the creator", (state) => {
    expect(dealGroups([deal("d", [state])], [])[0].name).toBe("Needs you");
  });

  test("a deal at the checklist, invite or changes step needs the creator; waiting for the brand doesn't", () => {
    const g = dealGroups([deal("c", ["no_draft"], { step: "checklist" }), deal("w", ["no_draft"], { step: "waiting_for_brand" }), deal("x", ["no_draft"], { step: "changes_requested" })], []);
    expect(g.find((x) => x.name === "Needs you")?.deals.map((d) => d.brandName)).toEqual(["c", "x"]);
    expect(g.find((x) => x.name === "Under way")?.deals.map((d) => d.brandName)).toEqual(["w"]);
  });

  test("a payout that failed or wasn't claimed needs the creator", () => {
    const stuck = aPayment({ dealId: "cap", deliverableId: "cap_0", stage: "captured", payout: { state: "failed" }, paidAt: undefined });
    expect(dealGroups([deal("cap", ["captured"])], [stuck])[0].name).toBe("Needs you");
    expect(dealGroups([deal("cap", ["captured"])], [])[0].name).toBe("Under way");
  });

  test("a group with no deals is left out", () => {
    expect(dealGroups([deal("r", ["checking"])], []).map((x) => x.name)).toEqual(["Under way"]);
  });

  test("each post says its platform and step in the switcher's words; a deal before agreeing shows its status line", () => {
    const [g] = dealGroups([deal("a", ["fully_passing"]), deal("b", ["no_draft"], { step: "waiting_for_brand", status: "Waiting for b to agree" })], []);
    expect(g.deals[0]).toMatchObject({ href: "/deals/a", posts: [{ post: "YouTube video", state: "fully_passing", words: "Brand review" }] });
    expect(g.deals[1]).toMatchObject({ posts: [], status: "Waiting for b to agree" });
  });
});

test("HM-FR-15 a post whose payout is stuck says so instead of its step", () => {
  const rows = [
    aPayment({ dealId: "j", deliverableId: "j_0", stage: "captured", payout: { state: "failed" }, paidAt: undefined }),
    aPayment({ dealId: "j", deliverableId: "j_1", stage: "captured", payout: { state: "unclaimed" }, paidAt: undefined }),
  ];
  const [g] = dealGroups([deal("j", ["captured", "captured"])], rows);
  expect(g.deals[0].posts.map((p) => [p.words, p.stuck])).toEqual([
    ["Payout didn’t go through", true],
    ["Waiting for you to accept the payout", true],
  ]);
});
