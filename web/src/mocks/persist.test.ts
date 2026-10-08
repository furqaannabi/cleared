import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { restoreMockData, snapshotMockData } from "./persist";
import { resetMockData } from "./store";

describe("Mock data kept in the browser", () => {
  test("a fresh start restored from the saved data still has the brand's notes, its session and new ids don't clash", async () => {
    await api.openBrandLink("demo_maple");
    await api.sendChanges("deal_maple", [{ about: { kind: "deal" }, text: "Could we add a Short?" }]);
    const saved = JSON.parse(JSON.stringify(snapshotMockData()));

    resetMockData(); // what a page load does today
    expect((await api.getInvite("deal_maple")).ok && (await api.getInvite("deal_maple"))).toMatchObject({ data: { step: "waiting_for_brand" } });

    restoreMockData(saved);
    const invite = await api.getInvite("deal_maple");
    expect(invite.ok && invite.data.notes?.map((n) => n.text)).toEqual(["Could we add a Short?"]);
    const brand = await api.getBrandDeal("deal_maple");
    expect(brand.ok && brand.data.step).toBe("changes_requested");
    const created = await api.createDeal({ brandName: "Fern Labs", deliverables: [{ platform: "youtube_video" }] });
    const ids = saved.drafts.map(([id]: [string]) => id);
    expect(created.ok && ids.includes(created.data.id)).toBe(false);
  });

  test("saved data that doesn't parse is ignored, leaving the seed", async () => {
    restoreMockData({ nonsense: true });
    const deals = await api.getDeals();
    expect(deals.ok && deals.data.some((d) => d.id === "deal_maple")).toBe(true);
  });
});
