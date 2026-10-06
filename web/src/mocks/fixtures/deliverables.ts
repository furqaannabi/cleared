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
  deadline: "2026-10-24T23:59:00Z",
  hold: { amountMinor: 120000, currency: "USD" },
  items: [
    { id: "it_1", name: "Mentions Glow Theory in the first 60 seconds", status: "passed" },
    { id: "it_2", name: "Sponsored segment runs at least 45 seconds", status: "passed" },
    { id: "it_3", name: "Glow Theory logo on screen for 3+ seconds", status: "passed", previousStatus: "unsure" },
    { id: "it_4", name: "Says discount code GLOW20", status: "passed", previousStatus: "fix_needed" },
    { id: "it_5", name: "Code GLOW20 shown on screen", status: "fix_needed" },
    { id: "it_6", name: "Serum shown in use", status: "unsure" },
    { id: "it_7", name: "Link glowtheory.com/ada in the description", status: "at_live_check" },
    { id: "it_8", name: "Marked as a paid promotion", status: "at_live_check" },
    { id: "it_9", name: "Public on your channel by 24 Oct", status: "at_live_check" },
  ],
};

export const deliverables: Record<string, Deliverable> = { [glowTheoryVideo.id]: glowTheoryVideo };
