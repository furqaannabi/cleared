import { describe, expect, test } from "vitest";
import { dealHref } from "./deal-href";

const deal = { id: "deal_1", brandName: "Glow Theory", status: "", deliverables: [] };

describe("dealHref (DC-FR-37, BC-FR-03, IN-FR-02)", () => {
  test("a deal at the checklist step opens its checklist", () => {
    expect(dealHref({ ...deal, step: "checklist" })).toBe("/deals/deal_1/checklist");
  });

  test("a deal at the invite step, or waiting for the brand, opens its invite page", () => {
    expect(dealHref({ ...deal, step: "invite" })).toBe("/deals/deal_1/invite");
    expect(dealHref({ ...deal, step: "waiting_for_brand" })).toBe("/deals/deal_1/invite");
  });

  test("otherwise the deliverable that needs the creator", () => {
    expect(dealHref({ ...deal, openDeliverableId: "del_1" })).toBe("/deals/deal_1/deliverables/del_1");
    expect(dealHref(deal)).toBeNull();
  });
});
