import type { z } from "zod";
import type { dealDraftSchema } from "@/lib/api/schemas";
import type { Deliverable } from "@/lib/deliverable/types";

/*
 * RW 1.0: a synthetic demo deal past confirm and hold, every post held, each
 * in one of the brand's review states: the video in its review window, the
 * Reel with an item the creator asked the brand about, the Short approved.
 * Opened as the brand with the demo link `demo_juniper`. All made up. Times
 * are relative to when the mock seeds, so the window is always open.
 */

type Draft = z.infer<typeof dealDraftSchema>;

export const JUNIPER = "deal_juniper";
export const JUNIPER_TOKEN = "demo_juniper";

const BRIEF = [
  "Thanks for partnering with Juniper & Salt on the Tide bath salts launch!",
  "In the YouTube video, say “Juniper & Salt” in the first 60 seconds.",
  "Show the bath salts dissolving in water.",
  "Say and show the code TIDE15.",
  "Mark the post as a paid promotion.",
].map((text, i) => ({ number: i + 1, text }));

const line = (n: number) => ({ number: n, text: BRIEF[n - 1].text });
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
/** DC-FR-44: 23:59 in Lagos on the day `days` from now. */
const deadline = (now: number, days: number) => `${iso(now + days * DAY).slice(0, 10)}T22:59:00Z`;

/** The deal draft: the agreed checklist, as the creator built it. */
export function juniperDraft(): Draft {
  const item = (id: string, deliverableId: string, name: string, kind: Draft["items"][number]["kind"], briefLine: number | undefined, checkedBy: Draft["items"][number]["checkedBy"]) => ({
    id,
    deliverableId,
    name,
    kind,
    ...(briefLine ? { briefLine } : {}),
    addedByCreator: !briefLine,
    checkedBy,
  });
  return {
    id: JUNIPER,
    brandName: "Juniper & Salt",
    step: "agreed",
    deliverables: [
      { id: "del_juniper_video", platform: "youtube_video" },
      { id: "del_juniper_reel", platform: "instagram_reel" },
      { id: "del_juniper_short", platform: "youtube_short" },
    ],
    brief: { lines: BRIEF },
    reading: "done",
    readUpTo: BRIEF.length,
    questions: [],
    ready: true,
    items: [
      item("jv_1", "del_juniper_video", "Say “Juniper & Salt” in the first 60 seconds", "said", 2, "ai_timestamp"),
      item("jv_2", "del_juniper_video", "Bath salts shown dissolving in water", "shown", 3, "ai_timestamp"),
      item("jv_3", "del_juniper_video", "Say the code TIDE15", "said", 4, "exact_match"),
      item("jv_4", "del_juniper_video", "Code TIDE15 shown on screen", "shown_as_text", 4, "exact_match"),
      item("jv_5", "del_juniper_video", "Marked as a paid promotion", "disclosure", 5, "at_live_check"),
      item("jv_6", "del_juniper_video", "juniperandsalt.com/ada in the description", "written", undefined, "at_live_check"),
      item("jr_1", "del_juniper_reel", "Bath salts shown dissolving in water", "shown", 3, "ai_timestamp"),
      item("jr_2", "del_juniper_reel", "Say the code TIDE15", "said", 4, "exact_match"),
      item("jr_3", "del_juniper_reel", "Code TIDE15 shown on screen", "shown_as_text", 4, "exact_match"),
      item("jr_4", "del_juniper_reel", "Paid partnership label on", "disclosure", 5, "at_live_check"),
      item("js_1", "del_juniper_short", "Code TIDE15 shown on screen", "shown_as_text", 4, "exact_match"),
      item("js_2", "del_juniper_short", "Bath salts shown dissolving in water", "shown", 3, "ai_timestamp"),
      item("js_3", "del_juniper_short", "Marked as a paid promotion", "disclosure", 5, "at_live_check"),
    ],
  };
}

/** The agreed terms per post. */
export const JUNIPER_TERMS = {
  del_juniper_video: { amount: "1500.00", deadlineDays: 14 },
  del_juniper_reel: { amount: "600.00", deadlineDays: 10 },
  del_juniper_short: { amount: "350.00", deadlineDays: 7 },
};

/** Each post's hold, approved three days ago (CH-BR-03 fixes the deadline then). */
export function juniperHolds(now: number) {
  return {
    del_juniper_video: { state: "held" as const, reference: "DEMO-JV7K2Q9P", deadline: deadline(now, 11).slice(0, 10) },
    del_juniper_reel: { state: "held" as const, reference: "DEMO-JR4M8T1X", deadline: deadline(now, 7).slice(0, 10) },
    del_juniper_short: { state: "held" as const, reference: "DEMO-JS2B6W3N", deadline: deadline(now, 4).slice(0, 10) },
  };
}

const LIVE = { label: "When", text: "Checked once the post is public." };

/** The draft check per post, in the brand's review states. */
export function juniperDeliverables(now: number): Deliverable[] {
  const holds = juniperHolds(now);
  const base = (id: keyof typeof holds, platform: Deliverable["platform"], amountMinor: number, days: number) => ({
    id,
    brandName: "Juniper & Salt",
    platform,
    deadline: deadline(now, days),
    creatorTimeZone: "Africa/Lagos",
    brief: BRIEF,
    hold: { amountMinor, currency: "USD", reference: holds[id].reference, heldAt: iso(now - 3 * DAY), stage: "held" as const },
    payoutEmail: "ada@example.com",
  });
  return [
    {
      ...base("del_juniper_video", "youtube_video", 150000, 11),
      state: "fully_passing",
      run: 2,
      reviewWindowEndsAt: iso(now + 31 * 3_600_000 + 12 * 60_000),
      draft: { fileName: "tide_video_v2.mp4", durationSec: 408, url: "/mock-media/synthetic-draft-16x9.mp4", urlExpiresAt: "2099-01-01T00:00:00Z" },
      items: [
        { id: "jv_1", name: "Say “Juniper & Salt” in the first 60 seconds", kind: "said", status: "passed", checkedBy: "ai_timestamp", briefLine: line(2),
          evidence: { label: "Transcript", text: "“…this is Juniper & Salt’s new Tide bath salts…”", startSec: 12 } },
        { id: "jv_2", name: "Bath salts shown dissolving in water", kind: "shown", status: "accepted_by_brand", previousStatus: "unsure", checkedBy: "ai_timestamp", briefLine: line(3),
          evidence: { label: "In frame", text: "Salts poured into the bath; the water clouds, but dissolving isn’t clearly shown.", startSec: 102, endSec: 118 } },
        { id: "jv_3", name: "Say the code TIDE15", kind: "said", status: "passed", previousStatus: "fix_needed", checkedBy: "exact_match", briefLine: line(4),
          evidence: { label: "Transcript", text: "“…use code TIDE15 for fifteen percent off…”", startSec: 189 } },
        { id: "jv_4", name: "Code TIDE15 shown on screen", kind: "shown_as_text", status: "passed", checkedBy: "exact_match", briefLine: line(4),
          evidence: { label: "On-screen text", text: "Reads “TIDE15”.", startSec: 195 } },
        { id: "jv_5", name: "Marked as a paid promotion", kind: "disclosure", status: "at_live_check", checkedBy: "published_post", briefLine: line(5), evidence: LIVE },
        { id: "jv_6", name: "juniperandsalt.com/ada in the description", kind: "written", status: "at_live_check", checkedBy: "published_post", evidence: LIVE },
      ],
    },
    {
      ...base("del_juniper_reel", "instagram_reel", 60000, 7),
      state: "results",
      run: 1,
      draft: { fileName: "tide_reel_v1.mp4", durationSec: 45, url: "/mock-media/synthetic-draft-9x16.mp4", urlExpiresAt: "2099-01-01T00:00:00Z" },
      items: [
        { id: "jr_1", name: "Bath salts shown dissolving in water", kind: "shown", status: "waiting_for_brand", checkedBy: "ai_timestamp", briefLine: line(3), askedAt: iso(now - 2 * 3_600_000),
          evidence: { label: "In frame", text: "Salts poured into a glass; it’s not clear they dissolve before the cut.", startSec: 14, endSec: 19 },
          fixHint: "Hold the shot on the glass until the salts have dissolved." },
        { id: "jr_2", name: "Say the code TIDE15", kind: "said", status: "passed", checkedBy: "exact_match", briefLine: line(4),
          evidence: { label: "Transcript", text: "“…code TIDE15…”", startSec: 31 } },
        { id: "jr_3", name: "Code TIDE15 shown on screen", kind: "shown_as_text", status: "passed", checkedBy: "exact_match", briefLine: line(4),
          evidence: { label: "On-screen text", text: "Reads “TIDE15”.", startSec: 33 } },
        { id: "jr_4", name: "Paid partnership label on", kind: "disclosure", status: "at_live_check", checkedBy: "published_post", briefLine: line(5), evidence: LIVE },
      ],
    },
    {
      ...base("del_juniper_short", "youtube_short", 35000, 4),
      state: "approved",
      run: 1,
      approvedAt: iso(now - 20 * 3_600_000),
      approvedBy: "brand",
      draft: { fileName: "tide_short_v1.mp4", durationSec: 45, url: "/mock-media/synthetic-draft-9x16.mp4", urlExpiresAt: "2099-01-01T00:00:00Z" },
      items: [
        { id: "js_1", name: "Code TIDE15 shown on screen", kind: "shown_as_text", status: "passed", checkedBy: "exact_match", briefLine: line(4),
          evidence: { label: "On-screen text", text: "Reads “TIDE15”.", startSec: 6 } },
        { id: "js_2", name: "Bath salts shown dissolving in water", kind: "shown", status: "passed", checkedBy: "ai_timestamp", briefLine: line(3),
          evidence: { label: "In frame", text: "Salts dissolve in a glass of water over four seconds.", startSec: 11, endSec: 15 } },
        { id: "js_3", name: "Marked as a paid promotion", kind: "disclosure", status: "at_live_check", checkedBy: "published_post", briefLine: line(5), evidence: LIVE },
      ],
    },
  ];
}
