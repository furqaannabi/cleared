/** A stand-in for YouTube: the videos a test says exist, read with the access a test says still works. */
import type { VideoRecord } from "../src/publish/live-check";
import type { YouTube } from "../src/publish/youtube";

export class FakeYouTube implements YouTube {
  private readonly videos = new Map<string, VideoRecord>();
  /** Access that has stopped working: revoked by the creator, or expired. */
  readonly lostAccess = new Set<string>();
  /** Makes every read fail, as YouTube being down or out of quota would. */
  down = false;
  /** Every read that was made: whose access, and which video. */
  readonly reads: { refreshToken: string; videoId: string }[] = [];

  async video(refreshToken: string, videoId: string) {
    this.reads.push({ refreshToken, videoId });
    if (this.down) throw new Error("YouTube returned 503");
    if (this.lostAccess.has(refreshToken)) return "no_access" as const;
    return this.videos.get(videoId) ?? ("not_found" as const);
  }

  // What a test controls

  /** A video on YouTube. Left alone it is a one-minute upload of 2,000 bytes, unlisted, on Sam's channel. */
  has(videoId: string, record: Partial<VideoRecord> = {}): VideoRecord {
    const video: VideoRecord = {
      videoId,
      privacy: "unlisted",
      channelId: "channel-sam",
      description: "",
      paidPromotion: false,
      fileSizeBytes: 2_000,
      durationSec: 60,
      ...record,
    };
    this.videos.set(videoId, video);
    return video;
  }

  /** Changes a video, as its creator would in YouTube Studio. */
  edit(videoId: string, change: Partial<VideoRecord>): void {
    const video = this.videos.get(videoId);
    if (!video) throw new Error(`No such video: ${videoId}`);
    this.videos.set(videoId, { ...video, ...change });
  }
}
