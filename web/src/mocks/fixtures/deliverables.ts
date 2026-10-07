import type { Deliverable } from "@/lib/deliverable/types";

/*
 * Synthetic fixtures. Glow Theory and Ada Okafor are made up. Shapes are
 * provisional (creator draft check FRD, "Mocks and the provisional contract").
 */

/** Glow Theory YouTube video, draft check run 2: one item to fix, one unsure. */
export const glowTheoryVideo: Deliverable = {
  id: "del_glow_video",
  brandName: "Glow Theory",
  platform: "youtube_video",
  state: "results",
  run: 2,
  deadline: "2026-10-24T22:59:00Z", // 23:59 in Lagos
  creatorTimeZone: "Africa/Lagos",
  hold: { amountMinor: 120000, currency: "USD", reference: "7HK21934LM", heldAt: "2026-10-03T10:00:00Z", stage: "held" },
  payoutEmail: "ada.okafor@example.com",
  brief: [
    { number: 1, text: "One YouTube video featuring the Dew Drop serum, posted on Ada's channel." },
    { number: 2, text: "Mention Glow Theory within the first minute." },
    { number: 3, text: "The sponsored segment should be at least 45 seconds long." },
    { number: 4, text: "Show our logo for at least 3 seconds." },
    { number: 5, text: "Say and show the code GLOW20." },
    { number: 6, text: "Show the Dew Drop serum being used on skin." },
    { number: 7, text: "Put glowtheory.com/ada in the description." },
    { number: 8, text: "Turn on YouTube's paid promotion label." },
    { number: 9, text: "Post by 24 October." },
  ],
  draft: {
    fileName: "draft_v2.mp4",
    durationSec: 408,
    url: "/mock-media/synthetic-draft-16x9.mp4",
    urlExpiresAt: "2099-01-01T00:00:00Z",
  },
  items: [
    { id: "it_1", name: "Mentions Glow Theory in the first 60 seconds", kind: "said", status: "passed", checkedBy: "ai_timestamp",
      briefLine: { number: 2, text: "Mention Glow Theory within the first minute." },
      evidence: { label: "Transcript", text: "“…today’s video is sponsored by Glow Theory.”", startSec: 42 } },
    { id: "it_2", name: "Sponsored segment runs at least 45 seconds", kind: "timing", status: "passed", checkedBy: "from_timestamps",
      briefLine: { number: 3, text: "The sponsored segment should be at least 45 seconds long." },
      evidence: { label: "Segment", text: "The segment runs 56 seconds.", startSec: 42, endSec: 98 } },
    { id: "it_3", name: "Glow Theory logo on screen for 3+ seconds", kind: "shown", status: "passed", previousStatus: "unsure", checkedBy: "ai_timestamp",
      briefLine: { number: 4, text: "Show our logo for at least 3 seconds." },
      evidence: { label: "In frame", text: "Logo on the box is visible for 4.2 seconds.", startSec: 70 } },
    { id: "it_4", name: "Says discount code GLOW20", kind: "said", status: "passed", previousStatus: "fix_needed", checkedBy: "exact_match",
      briefLine: { number: 5, text: "Say and show the code GLOW20." },
      evidence: { label: "Transcript", text: "“…use code GLOW20 for 20% off your first order.”", startSec: 126 } },
    { id: "it_5", name: "Code GLOW20 shown on screen", kind: "shown_as_text", status: "fix_needed", checkedBy: "exact_match",
      briefLine: { number: 5, text: "Say and show the code GLOW20." },
      evidence: { label: "On-screen text", text: "Reads “GLOW2O”, with a letter O where the zero should be.", startSec: 195 } },
    { id: "it_6", name: "Serum shown in use", kind: "shown", status: "unsure", checkedBy: "ai_timestamp", askable: true,
      briefLine: { number: 6, text: "Show the Dew Drop serum being used on skin." },
      evidence: { label: "In frame", text: "The bottle is in frame, but it isn’t clear the serum is being applied.", startSec: 242 } },
    { id: "it_7", name: "Link glowtheory.com/ada in the description", kind: "written", status: "at_live_check", checkedBy: "published_post",
      briefLine: { number: 7, text: "Put glowtheory.com/ada in the description." },
      evidence: { label: "When", text: "Checked once the video is public." } },
    { id: "it_8", name: "Marked as a paid promotion", kind: "disclosure", status: "at_live_check", checkedBy: "published_post",
      briefLine: { number: 8, text: "Turn on YouTube’s paid promotion label." },
      evidence: { label: "When", text: "Checked once the video is public." } },
    { id: "it_9", name: "Public on your channel by 24 Oct", kind: "publication", status: "at_live_check", checkedBy: "platform_record",
      briefLine: { number: 9, text: "Post by 24 October." },
      evidence: { label: "When", text: "Checked once the video is public." } },
  ],
};

/** The same deliverable after its deadline passed: the hold went back to the brand. */
export const glowTheoryVideoReleased: Deliverable = {
  ...glowTheoryVideo,
  id: "del_glow_released",
  state: "released",
  releasedAt: "2026-10-25T09:00:00Z",
  releaseReason: "deadline",
};

/** The same deliverable after run 3 failed on Cleared's side, with no automatic retry. */
export const glowTheoryVideoFailedOurs: Deliverable = {
  ...glowTheoryVideo,
  id: "del_glow_failed_ours",
  state: "check_failed",
  checkFailure: { kind: "ours", retrying: false, fileName: "draft_v3.mp4" },
};

/** Northbound Coffee YouTube Short: every item passed, the brand's review window is open. */
export const northboundShort: Deliverable = {
  id: "del_nb_short",
  brandName: "Northbound Coffee",
  platform: "youtube_short",
  state: "fully_passing",
  run: 1,
  deadline: "2026-10-20T22:59:00Z",
  creatorTimeZone: "Africa/Lagos",
  hold: { amountMinor: 45000, currency: "USD", reference: "3PN88120QA", heldAt: "2026-10-02T09:00:00Z", stage: "held" },
  payoutEmail: "ada.okafor@example.com",
  reviewWindowEndsAt: "2026-10-08T14:00:00Z",
  draft: { fileName: "nb_short_v1.mp4", durationSec: 45, url: "/mock-media/synthetic-draft-9x16.mp4", urlExpiresAt: "2099-01-01T00:00:00Z" },
  brief: [
    { number: 1, text: "One YouTube Short about the Morning Ritual blend." },
    { number: 2, text: "Say \"Northbound Coffee\" in the first 10 seconds." },
    { number: 3, text: "Show the bag on screen." },
    { number: 4, text: "Put northbound.coffee/ada in the description." },
  ],
  items: [
    { id: "nb_1", name: "Says Northbound Coffee in the first 10 seconds", kind: "said", status: "passed", checkedBy: "ai_timestamp",
      briefLine: { number: 2, text: "Say \"Northbound Coffee\" in the first 10 seconds." },
      evidence: { label: "Transcript", text: "“…this is Northbound Coffee’s Morning Ritual.”", startSec: 4 } },
    { id: "nb_2", name: "The bag is shown on screen", kind: "shown", status: "passed", checkedBy: "ai_timestamp",
      briefLine: { number: 3, text: "Show the bag on screen." },
      evidence: { label: "In frame", text: "The bag is in frame for 6 seconds.", startSec: 18, endSec: 24 } },
    { id: "nb_3", name: "Link northbound.coffee/ada in the description", kind: "written", status: "at_live_check", checkedBy: "published_post",
      briefLine: { number: 4, text: "Put northbound.coffee/ada in the description." },
      evidence: { label: "When", text: "Checked once the Short is public." } },
  ],
};

/** Kora Audio Instagram Reel: the checklist is agreed and held, no draft yet. */
export const koraReel: Deliverable = {
  id: "del_kora_reel",
  brandName: "Kora Audio",
  platform: "instagram_reel",
  state: "no_draft",
  run: 0,
  deadline: "2026-10-27T22:59:00Z",
  creatorTimeZone: "Africa/Lagos",
  hold: { amountMinor: 80000, currency: "USD", reference: "8KA20044TR", heldAt: "2026-10-06T16:00:00Z", stage: "held" },
  payoutEmail: "ada.okafor@example.com",
  items: [
    { id: "ka_1", name: "Names the Kora Pods in the first 5 seconds", kind: "said", status: "not_checked", checkedBy: "ai_timestamp",
      briefLine: { number: 2, text: "Name the Kora Pods early." } },
    { id: "ka_2", name: "Caption has #ad and kora.audio/ada", kind: "written", status: "at_live_check", checkedBy: "published_post",
      briefLine: { number: 3, text: "Caption must include #ad and our link." } },
  ],
};

/** Glow Theory's second deliverable, an Instagram Reel: one item waits for the brand. */
export const glowTheoryReel: Deliverable = {
  id: "del_glow_reel",
  brandName: "Glow Theory",
  platform: "instagram_reel",
  state: "results",
  run: 1,
  deadline: "2026-10-24T22:59:00Z",
  creatorTimeZone: "Africa/Lagos",
  hold: { amountMinor: 65000, currency: "USD", reference: "9QD40211XP", heldAt: "2026-10-03T10:00:00Z", stage: "held" },
  payoutEmail: "ada.okafor@example.com",
  draft: { fileName: "reel_draft_v1.mp4", durationSec: 45, url: "/mock-media/synthetic-draft-9x16.mp4", urlExpiresAt: "2099-01-01T00:00:00Z" },
  brief: glowTheoryVideo.brief,
  items: [
    { id: "gr_1", name: "Names the Dew Drop serum clearly", kind: "said", status: "waiting_for_brand", askedAt: "2026-10-06T10:00:00Z", checkedBy: "ai_timestamp",
      briefLine: { number: 6, text: "Show the Dew Drop serum being used on skin." },
      evidence: { label: "Transcript", text: "“…this is the dew drop…” is said quickly and may be heard as “due drop”.", startSec: 8 } },
    { id: "gr_2", name: "Says discount code GLOW20", kind: "said", status: "passed", checkedBy: "exact_match",
      briefLine: { number: 5, text: "Say and show the code GLOW20." },
      evidence: { label: "Transcript", text: "“…code GLOW20 gets you 20% off.”", startSec: 14 } },
    { id: "gr_3", name: "Serum shown in use", kind: "shown", status: "passed", checkedBy: "ai_timestamp",
      briefLine: { number: 6, text: "Show the Dew Drop serum being used on skin." },
      evidence: { label: "In frame", text: "Serum is applied to the cheek for 7 seconds.", startSec: 22, endSec: 29 } },
    { id: "gr_4", name: "Caption has #ad and glowtheory.com/ada", kind: "written", status: "at_live_check", checkedBy: "published_post",
      briefLine: { number: 7, text: "Put glowtheory.com/ada in the description." },
      evidence: { label: "When", text: "Checked once the Reel is public." } },
  ],
};

export const deliverables: Record<string, Deliverable> = Object.fromEntries(
  [glowTheoryVideo, glowTheoryVideoReleased, glowTheoryVideoFailedOurs, glowTheoryReel, northboundShort, koraReel].map((d) => [d.id, d]),
);
