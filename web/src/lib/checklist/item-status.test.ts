import { describe, expect, test } from "vitest";
import { ITEM_STATUSES, describeStatus, tabsFor } from "./item-status";

const BRAND = "Glow Theory";

describe("DC-FR-13 item status map", () => {
  test("every status has a word and an icon, never colour alone", () => {
    for (const status of ITEM_STATUSES) {
      const { label, icon } = describeStatus(status, BRAND);
      expect(label.trim(), status).not.toBe("");
      expect(icon, status).toBeTruthy();
    }
  });

  test("names the brand in the waiting and accepted words", () => {
    expect(describeStatus("waiting_for_brand", BRAND).label).toBe("Waiting for Glow Theory");
    expect(describeStatus("accepted_by_brand", BRAND).label).toBe("Accepted by Glow Theory");
  });

  test("only Passed uses the pass tone; accepted by the brand is never green", () => {
    const passTone = ITEM_STATUSES.filter((s) => describeStatus(s, BRAND).tone === "pass");
    expect(passTone).toEqual(["passed"]);
    expect(describeStatus("accepted_by_brand", BRAND).tone).toBe("accepted");
  });

  test("DC-BR-01: unsure stays unsure and never counts as passed", () => {
    expect(describeStatus("unsure", BRAND)).toMatchObject({ label: "Unsure", tone: "unsure" });
    expect(tabsFor("unsure")).not.toContain("passed");
  });

  test("DC-FR-20: each status sits under All and its own filter tab", () => {
    expect(tabsFor("fix_needed")).toEqual(["all", "needs_you"]);
    expect(tabsFor("unsure")).toEqual(["all", "needs_you"]);
    expect(tabsFor("passed")).toEqual(["all", "passed"]);
    expect(tabsFor("accepted_by_brand")).toEqual(["all", "passed"]);
    expect(tabsFor("waiting_for_brand")).toEqual(["all", "waiting_for_brand"]);
    expect(tabsFor("at_live_check")).toEqual(["all", "at_live_check"]);
    expect(tabsFor("checking")).toEqual(["all"]);
    expect(tabsFor("not_checked")).toEqual(["all"]);
  });
});

describe("needs-first order", () => {
  test("puts what needs the creator first, then what waits, then what is settled, keeping brief order within each", async () => {
    const { byNeed } = await import("./item-status");
    const items = [
      { id: "a", status: "passed" as const },
      { id: "b", status: "unsure" as const },
      { id: "c", status: "at_live_check" as const },
      { id: "d", status: "fix_needed" as const },
      { id: "e", status: "waiting_for_brand" as const },
      { id: "f", status: "passed" as const },
    ];
    expect(byNeed(items).map((i) => i.id)).toEqual(["d", "b", "e", "a", "f", "c"]);
  });
});
