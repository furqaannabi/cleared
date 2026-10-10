/**
 * Reading a video file itself (draft check and review spec DR-FR-03). What a file is comes from
 * reading it, never from its name or the type the browser claimed. The real one runs ffprobe; tests
 * use a stand-in.
 */
export interface Media {
  /**
   * What the file at an address is: its container and its length. "unreadable" if it cannot be read as
   * a video at all, or has no video in it.
   */
  probe(address: string): Promise<{ format: "mp4" | "mov" | "other"; durationSec: number } | "unreadable">;
  /** Still frames cut from the file at these moments, in seconds, one image for each. For the second look (DR-FR-19). */
  frames(address: string, timesSec: number[]): Promise<Uint8Array[]>;
}
