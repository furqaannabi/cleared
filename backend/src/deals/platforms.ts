/**
 * The posts a deal can have: YouTube videos and Shorts, and Instagram Reels (Instagram Reels spec
 * IG-FR-07). Kept on its own so that the deals module and the brief reader can both use it.
 */
export const PLATFORMS = ["youtube_video", "youtube_short", "instagram_reel"] as const;
export type Platform = (typeof PLATFORMS)[number];
