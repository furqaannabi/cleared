import type { BrandPost } from "./stub-api";
import { stubState } from "./stub-state";

/*
 * Juniper & Salt's three held posts as the brand reads each one, as the
 * contract's `GET /brand/deals/{id}/deliverables/{id}` answers it. Synthetic:
 * Juniper & Salt and Ada Okafor are made up. Each builder takes the post's
 * review state and any other change.
 */

type Review = BrandPost["review"];

/** The YouTube video: every item passed or accepted, two at the live check; in its review window unless given another review. */
export const juniperVideo = (p: Partial<BrandPost> = {}, review: Review = { state: "window", endsAt: new Date(Date.now() + 31 * 3600_000 + 11.5 * 60_000).toISOString() }): BrandPost => ({
  dealId: "deal_juniper",
  deliverableId: "del_juniper_video",
  creatorName: "Ada Okafor",
  brandName: "Juniper & Salt",
  platform: "youtube_video",
  creatorTimeZone: "Africa/Lagos",
  hold: {
    amount: "1500.00",
    reference: "7HK21934LM",
    deadline: "2026-10-23T22:59:00Z",
  },
  cancel: {
    allowed: true,
  },
  draft: {
    url: "/mock-media/synthetic-draft-16x9.mp4",
    urlExpiresAt: "2099-01-01T00:00:00Z",
    durationSec: 408,
    items: [
      {
        id: "jv_1",
        name: "Say “Juniper & Salt” in the first 60 seconds",
        kind: "said",
        checkedBy: "ai_timestamp",
        status: "passed",
        briefLine: {
          number: 2,
          text: "In the YouTube video, say “Juniper & Salt” in the first 60 seconds.",
        },
        evidence: {
          label: "Transcript",
          text: "“…this is Juniper & Salt’s new Tide bath salts…”",
          startSec: 12,
          endSec: 0,
        }
      },
      {
        id: "jv_2",
        name: "Bath salts shown dissolving in water",
        kind: "shown",
        checkedBy: "ai_timestamp",
        status: "accepted",
        briefLine: {
          number: 3,
          text: "Show the bath salts dissolving in water.",
        },
        evidence: {
          label: "In frame",
          text: "Salts poured into the bath; the water clouds, but dissolving isn’t clearly shown.",
          startSec: 102,
          endSec: 118,
        }
      },
      {
        id: "jv_3",
        name: "Say the code TIDE15",
        kind: "said",
        checkedBy: "exact_match",
        status: "passed",
        briefLine: {
          number: 4,
          text: "Say and show the code TIDE15.",
        },
        evidence: {
          label: "Transcript",
          text: "“…use code TIDE15 for fifteen percent off…”",
          startSec: 189,
          endSec: 0,
        }
      },
      {
        id: "jv_4",
        name: "Code TIDE15 shown on screen",
        kind: "shown_as_text",
        checkedBy: "exact_match",
        status: "passed",
        briefLine: {
          number: 4,
          text: "Say and show the code TIDE15.",
        },
        evidence: {
          label: "On-screen text",
          text: "Reads “TIDE15”.",
          startSec: 195,
          endSec: 0,
        }
      },
      {
        id: "jv_5",
        name: "Marked as a paid promotion",
        kind: "disclosure",
        checkedBy: "published_post",
        status: "at_live_check",
        briefLine: {
          number: 5,
          text: "Mark the post as a paid promotion.",
        },
        evidence: {
          label: "When",
          text: "Checked once the post is public.",
          startSec: 0,
          endSec: 0,
        }
      },
      {
        id: "jv_6",
        name: "juniperandsalt.com/ada in the description",
        kind: "written",
        checkedBy: "published_post",
        status: "at_live_check",
        evidence: {
          label: "When",
          text: "Checked once the post is public.",
          startSec: 0,
          endSec: 0,
        }
      },
    ]
  },
  review,
  ...p,
});

/** The Instagram Reel: Ada asked the brand to accept one item. */
export const juniperReel = (p: Partial<BrandPost> = {}, review: Review = { state: "asked" }): BrandPost => ({
  dealId: "deal_juniper",
  deliverableId: "del_juniper_reel",
  creatorName: "Ada Okafor",
  brandName: "Juniper & Salt",
  platform: "instagram_reel",
  creatorTimeZone: "Africa/Lagos",
  hold: {
    amount: "600.00",
    reference: "8JL32045MN",
    deadline: "2026-10-19T22:59:00Z",
  },
  cancel: {
    allowed: true,
  },
  draft: {
    url: "/mock-media/synthetic-draft-9x16.mp4",
    urlExpiresAt: "2099-01-01T00:00:00Z",
    durationSec: 45,
    items: [
      {
        id: "jr_1",
        name: "Bath salts shown dissolving in water",
        kind: "shown",
        checkedBy: "ai_timestamp",
        status: "asked",
        briefLine: {
          number: 3,
          text: "Show the bath salts dissolving in water.",
        },
        evidence: {
          label: "In frame",
          text: "Salts poured into a glass; it’s not clear they dissolve before the cut.",
          startSec: 14,
          endSec: 19,
        }
      },
      {
        id: "jr_2",
        name: "Say the code TIDE15",
        kind: "said",
        checkedBy: "exact_match",
        status: "passed",
        briefLine: {
          number: 4,
          text: "Say and show the code TIDE15.",
        },
        evidence: {
          label: "Transcript",
          text: "“…code TIDE15…”",
          startSec: 31,
          endSec: 0,
        }
      },
      {
        id: "jr_3",
        name: "Code TIDE15 shown on screen",
        kind: "shown_as_text",
        checkedBy: "exact_match",
        status: "passed",
        briefLine: {
          number: 4,
          text: "Say and show the code TIDE15.",
        },
        evidence: {
          label: "On-screen text",
          text: "Reads “TIDE15”.",
          startSec: 33,
          endSec: 0,
        }
      },
      {
        id: "jr_4",
        name: "Paid partnership label on",
        kind: "disclosure",
        checkedBy: "published_post",
        status: "at_live_check",
        briefLine: {
          number: 5,
          text: "Mark the post as a paid promotion.",
        },
        evidence: {
          label: "When",
          text: "Checked once the post is public.",
          startSec: 0,
          endSec: 0,
        }
      },
    ]
  },
  review,
  ...p,
});

/** The YouTube Short: approved by the brand. */
export const juniperShort = (p: Partial<BrandPost> = {}, review: Review = { state: "approved", approvedAt: new Date(Date.now() - 24 * 3600_000).toISOString(), by: "brand" }): BrandPost => ({
  dealId: "deal_juniper",
  deliverableId: "del_juniper_short",
  creatorName: "Ada Okafor",
  brandName: "Juniper & Salt",
  platform: "youtube_short",
  creatorTimeZone: "Africa/Lagos",
  hold: {
    amount: "350.00",
    reference: "9KM43156NP",
    deadline: "2026-10-16T22:59:00Z",
  },
  cancel: {
    allowed: true,
  },
  draft: {
    url: "/mock-media/synthetic-draft-9x16.mp4",
    urlExpiresAt: "2099-01-01T00:00:00Z",
    durationSec: 45,
    items: [
      {
        id: "js_1",
        name: "Code TIDE15 shown on screen",
        kind: "shown_as_text",
        checkedBy: "exact_match",
        status: "passed",
        briefLine: {
          number: 4,
          text: "Say and show the code TIDE15.",
        },
        evidence: {
          label: "On-screen text",
          text: "Reads “TIDE15”.",
          startSec: 6,
          endSec: 0,
        }
      },
      {
        id: "js_2",
        name: "Bath salts shown dissolving in water",
        kind: "shown",
        checkedBy: "ai_timestamp",
        status: "passed",
        briefLine: {
          number: 3,
          text: "Show the bath salts dissolving in water.",
        },
        evidence: {
          label: "In frame",
          text: "Salts dissolve in a glass of water over four seconds.",
          startSec: 11,
          endSec: 15,
        }
      },
      {
        id: "js_3",
        name: "Marked as a paid promotion",
        kind: "disclosure",
        checkedBy: "published_post",
        status: "at_live_check",
        briefLine: {
          number: 5,
          text: "Mark the post as a paid promotion.",
        },
        evidence: {
          label: "When",
          text: "Checked once the post is public.",
          startSec: 0,
          endSec: 0,
        }
      },
    ]
  },
  review,
  ...p,
});

/**
 * This test's post as the brand reads it: `GET` answers it as it now stands;
 * `on` answers an action with the post it leads to.
 *
 * @param post - the post as the page first reads it
 */
export const stubReview = (post: BrandPost) => stubState(`/brand/deals/${post.dealId}/deliverables/${post.deliverableId}`, post);
