/**
 * What the backend reads from YouTube after a draft is approved (publish to paid spec PT-FR-02,
 * PT-FR-11): one video's record, with a creator's stored read-only access. The real one calls the
 * YouTube Data API; tests use a stand-in. Nothing is ever written to a creator's channel (PT-BR-07).
 */
import type { VideoRecord } from "./live-check";

export interface YouTube {
  /**
   * The record of one video, read as the creator whose access this is. "not_found" when there is no
   * such video they can see. "no_access" when the access no longer works: revoked, or expired. A
   * failure of YouTube itself is thrown.
   */
  video(refreshToken: string, videoId: string): Promise<VideoRecord | "not_found" | "no_access">;
}
