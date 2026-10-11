import { describe, expect, test } from "vitest";
import { keepingEmailNote } from "./keeping-email";

const deals = [
  { id: "deal_glow", deliverables: [{ id: "del_glow_video", platform: "youtube_video" as const }, { id: "del_glow_reel", platform: "instagram_reel" as const }] },
];

describe("IN-FR-12 (1.3) payouts that keep the old PayPal email", () => {
  test("nothing to say when every payout follows the new email", () => {
    expect(keepingEmailNote([], deals)).toBeNull();
  });

  test("one line per post, named by its brand and platform, with the email it keeps", () => {
    expect(
      keepingEmailNote(
        [
          { deliverableId: "del_glow_video", dealId: "deal_glow", brandName: "Glow Theory", email: "ada@old.com" },
          { deliverableId: "del_glow_reel", dealId: "deal_glow", brandName: "Glow Theory", email: "ada@old.com" },
        ],
        deals,
      ),
    ).toEqual({
      lead: "Saved. Payouts already with PayPal still go to the email they were sent to:",
      lines: ["Glow Theory · YouTube video: ada@old.com", "Glow Theory · Instagram Reel: ada@old.com"],
    });
  });

  test("one post reads in the singular; a post the deals list doesn't know is named by its brand", () => {
    expect(keepingEmailNote([{ deliverableId: "del_x", dealId: "deal_x", brandName: "Fern Studio", email: "ada@old.com" }], deals)).toEqual({
      lead: "Saved. A payout already with PayPal still goes to ada@old.com:",
      lines: ["Fern Studio"],
    });
  });
});
