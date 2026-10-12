import { describe, expect, test } from "vitest";
import { performanceFigures } from "./performance";
import { aPayment } from "./test-rows";

const DEADLINE = "2026-10-08T23:59:00.000Z";

describe("HM-FR-08 on time", () => {
  test("counts posts that went live, and those at or before their deadline", () => {
    const f = performanceFigures([
      aPayment({ publishedAt: DEADLINE, deadline: DEADLINE }),
      aPayment({ publishedAt: "2026-10-09T00:00:00.000Z", deadline: DEADLINE }),
      aPayment({ stage: "held", publishedAt: undefined, paidAt: undefined, payout: undefined }),
    ]);
    expect(f.onTime).toBe("1 of 2 posts");
  });

  test("one post is one, never a percentage", () => {
    expect(performanceFigures([aPayment()]).onTime).toBe("1 of 1 post");
  });
});

describe("HM-FR-09 passed first time", () => {
  test("counts posts whose first draft check finished", () => {
    const f = performanceFigures([aPayment({ firstCheckPassed: true }), aPayment({ firstCheckPassed: false }), aPayment({ firstCheckPassed: null })]);
    expect(f.passedFirstTime).toBe("1 of 2 drafts");
  });
});

describe("HM-FR-10 time to paid", () => {
  const paid = (hours: number) => aPayment({ publishedAt: "2026-10-01T00:00:00.000Z", paidAt: new Date(Date.parse("2026-10-01T00:00:00.000Z") + hours * 3600_000).toISOString() });

  test("in hours under two days", () => {
    expect(performanceFigures([paid(18), paid(22)]).timeToPaid).toBe("20 hours");
    expect(performanceFigures([paid(1)]).timeToPaid).toBe("1 hour");
  });

  test("in days from two, rounded", () => {
    expect(performanceFigures([paid(48)]).timeToPaid).toBe("2 days");
    expect(performanceFigures([paid(60), paid(84)]).timeToPaid).toBe("3 days");
  });
});

describe("HM-FR-11 a figure with nothing to count is left out", () => {
  test("no published, checked or paid posts gives no figures", () => {
    const f = performanceFigures([aPayment({ stage: "held", publishedAt: undefined, paidAt: undefined, payout: undefined, firstCheckPassed: null })]);
    expect(f).toEqual({});
  });
});
