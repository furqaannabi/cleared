import { stubState } from "./stub-state";
import { aDealDraft, type DealDraft } from "./stub-api";

/** The Glow Theory brief, six lines, as the creator pastes it. */
export const GLOW_BRIEF = [
  "Thanks for partnering with Glow Theory on the Dew Drop serum launch!",
  "In the YouTube video, say “Glow Theory” in the first 60 seconds.",
  "Mention us early in the Reel.",
  "Say and show the code GLOW20.",
  "Keep it fun and authentic!",
  "Mark the post as a paid promotion.",
];

const item = (id: string, deliverableId: string, name: string, kind: DealDraft["items"][number]["kind"], briefLine: number, checkedBy: DealDraft["items"][number]["checkedBy"]) => ({
  id,
  deliverableId,
  name,
  kind,
  briefLine,
  addedByCreator: false,
  checkedBy,
});

/**
 * Glow Theory's deal once its brief is read, as the contract's `GET
 * /deals/{id}` answers it: a YouTube video and a Reel, seven items and two
 * questions (line 3 how early, line 5 can't be checked); override any field.
 */
export const aReadDraft = (d: Partial<DealDraft> = {}): DealDraft =>
  aDealDraft({
    id: "deal_glow",
    deliverables: [
      { id: "del_glow_video", platform: "youtube_video" },
      { id: "del_glow_reel", platform: "instagram_reel" },
    ],
    brief: { lines: GLOW_BRIEF.map((text, i) => ({ number: i + 1, text })) },
    reading: "done",
    items: [
      item("it_glow_first", "del_glow_video", "Says “Glow Theory” in the first 60 seconds", "timing", 2, "ai_timestamp"),
      item("it_glow_code_v", "del_glow_video", "Says the code GLOW20", "said", 4, "exact_match"),
      item("it_glow_code_r", "del_glow_reel", "Says the code GLOW20", "said", 4, "exact_match"),
      item("it_glow_show_v", "del_glow_video", "Shows the code GLOW20 on screen", "shown_as_text", 4, "exact_match"),
      item("it_glow_show_r", "del_glow_reel", "Shows the code GLOW20 on screen", "shown_as_text", 4, "exact_match"),
      item("it_glow_paid_v", "del_glow_video", "Marked as a paid promotion", "disclosure", 6, "at_live_check"),
      item("it_glow_paid_r", "del_glow_reel", "Marked as a paid promotion", "disclosure", 6, "at_live_check"),
    ],
    questions: [
      { id: "q_glow_early", briefLine: 3, text: "“Mention us early in the Reel”: how early?", suggestions: ["In the first 10 seconds", "In the first 30 seconds"] },
      { id: "q_glow_fun", briefLine: 5, text: "“Keep it fun and authentic” can’t be checked in a video. Leave it out?", suggestions: [] },
    ],
    ...d,
  });

/**
 * This test's deal: `GET /deals/{id}` answers the deal as it now stands, and
 * `on` answers one change with the deal it leads to.
 *
 * @param draft - the deal as the page first reads it
 */
export const stubDealDraft = (draft: DealDraft) => stubState(`/deals/${draft.id}`, draft);
