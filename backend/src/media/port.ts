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
}
