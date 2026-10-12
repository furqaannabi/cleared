import { aBrandDeal, type BrandDeal } from "./stub-api";
import { stubState } from "./stub-state";

/**
 * Maple & Moss's deal as the brand sees it from its link, as the contract's
 * `GET /brand/deals/{id}` answers it: three posts (a video, a Reel and a
 * Short, $1,950 in all), twelve items, one added by the creator, one brief
 * line settled and one left out; override any field.
 */
export const aMapleDeal = (d: Partial<BrandDeal> = {}): BrandDeal =>
  aBrandDeal({
    posts: [
      { deliverableId: "del_maple_video", platform: "youtube_video", amount: "1200.00", deadlineDays: 14, hold: { state: "not_started" }, cancel: { allowed: true } },
      { deliverableId: "del_maple_reel", platform: "instagram_reel", amount: "450.00", deadlineDays: 10, hold: { state: "not_started" }, cancel: { allowed: true } },
      { deliverableId: "del_maple_short", platform: "youtube_short", amount: "300.00", deadlineDays: 7, hold: { state: "not_started" }, cancel: { allowed: true } },
    ],
    items: [
      { id: "it_maple_first", deliverableId: "del_maple_video", name: "Says “Maple & Moss” in the first 60 seconds", briefLine: 2, addedByCreator: false },
      { id: "it_maple_early", deliverableId: "del_maple_reel", name: "Mentions Maple & Moss in the first 10 seconds", briefLine: 3, addedByCreator: false },
      { id: "it_maple_code_v", deliverableId: "del_maple_video", name: "Says the code MOSS10", briefLine: 4, addedByCreator: false },
      { id: "it_maple_code_r", deliverableId: "del_maple_reel", name: "Says the code MOSS10", briefLine: 4, addedByCreator: false },
      { id: "it_maple_code_s", deliverableId: "del_maple_short", name: "Says the code MOSS10", briefLine: 4, addedByCreator: false },
      { id: "it_maple_show_v", deliverableId: "del_maple_video", name: "Shows the code MOSS10 on screen", briefLine: 4, addedByCreator: false },
      { id: "it_maple_show_r", deliverableId: "del_maple_reel", name: "Shows the code MOSS10 on screen", briefLine: 4, addedByCreator: false },
      { id: "it_maple_show_s", deliverableId: "del_maple_short", name: "Shows the code MOSS10 on screen", briefLine: 4, addedByCreator: false },
      { id: "it_maple_paid_v", deliverableId: "del_maple_video", name: "Marked as a paid promotion", briefLine: 6, addedByCreator: false },
      { id: "it_maple_paid_r", deliverableId: "del_maple_reel", name: "Marked as a paid promotion", briefLine: 6, addedByCreator: false },
      { id: "it_maple_paid_s", deliverableId: "del_maple_short", name: "Marked as a paid promotion", briefLine: 6, addedByCreator: false },
      { id: "it_maple_link", deliverableId: "del_maple_video", name: "maplemoss.com/ada in the description", addedByCreator: true },
    ],
    brief: [
      { number: 1, text: "Thanks for partnering with Maple & Moss on the Ember candle launch!" },
      { number: 2, text: "In the YouTube video, say “Maple & Moss” in the first 60 seconds." },
      { number: 3, text: "Mention us early in the Reel." },
      { number: 4, text: "Say and show the code MOSS10." },
      { number: 5, text: "Keep it fun and cosy!" },
      { number: 6, text: "Mark the post as a paid promotion." },
    ],
    answers: [
      { briefLine: 3, kind: "suggestion", text: "In the first 10 seconds" },
      { briefLine: 5, kind: "left_out" },
    ],
    ...d,
  });

/**
 * This test's Maple & Moss deal: `GET /brand/deals/deal_maple` answers it as
 * it now stands; `on` answers a change with the deal it leads to.
 */
export const stubMapleDeal = (d: Partial<BrandDeal> = {}) => stubState("/brand/deals/deal_maple", aMapleDeal(d));

/** Juniper & Salt's deal, every post held: the video in its review window, the Reel asked about, the Short approved. */
export const aJuniperDeal = (d: Partial<BrandDeal> = {}): BrandDeal => {
  const [video, reel, short] = aMapleDeal().posts;
  return aBrandDeal({
    dealId: "deal_juniper",
    brandName: "Juniper & Salt",
    step: "agreed",
    agreedAt: "2026-10-09T11:24:09.584Z",
    posts: [
      { ...video, deliverableId: "del_juniper_video", amount: "1500.00", hold: { state: "held", reference: "7HK21934LM", deadline: "2026-10-23" }, review: { state: "window", endsAt: new Date(Date.now() + 31 * 3600_000 + 11.5 * 60_000).toISOString() } },
      { ...reel, deliverableId: "del_juniper_reel", amount: "600.00", hold: { state: "held", reference: "8JL32045MN", deadline: "2026-10-19" }, review: { state: "asked", count: 1 } },
      { ...short, deliverableId: "del_juniper_short", amount: "350.00", hold: { state: "held", reference: "9KM43156NP", deadline: "2026-10-16" }, review: { state: "approved" } },
    ],
    ...d,
  });
};
