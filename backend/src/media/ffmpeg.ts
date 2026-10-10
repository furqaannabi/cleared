/**
 * The real media port: ffprobe and ffmpeg (draft check and review spec DR-FR-03, DR-FR-19).
 *
 * The file is a stranger's. Its first bytes are checked before either program is run, and both are
 * told to read it only as an MP4 or MOV and only over https. Without that, a file that is really a
 * playlist could make them fetch other addresses or read local files. They are started with their
 * arguments as a list, never through a shell, and are stopped if they run too long.
 *
 * Not yet proven against real ffmpeg: it is not installed where this was written.
 */
import type { Media } from "./port";

/** Runs one of the two programs with these arguments, and answers with how it ended and what it printed. */
export type Runner = (program: "ffprobe" | "ffmpeg", args: string[]) => Promise<{ code: number; stdout: Uint8Array }>;

/** Read as MP4 or MOV, whatever the file claims to be, and over https and nothing else. */
const SAFE_INPUT = ["-f", "mov", "-protocol_whitelist", "https,tls,tcp"];

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));

/** The first boxes an MP4 or MOV file can start with. */
const ISO_BOXES = ["ftyp", "moov", "mdat", "wide", "free", "skip", "pnot"];

/**
 * What a file is, from its first bytes: an MP4 or MOV, some other kind of video, or nothing readable
 * as a video. This is decided before any program reads the file.
 */
export function sniff(head: Uint8Array): "mp4_or_mov" | "other_video" | "not_video" {
  if (head.length >= 8 && ISO_BOXES.includes(ascii(head, 4, 8))) return "mp4_or_mov";
  const starts = (...bytes: number[]) => bytes.every((byte, index) => head[index] === byte);
  // WebM and Matroska, AVI, Flash video, Windows Media, Ogg, and an MPEG transport stream.
  if (starts(0x1a, 0x45, 0xdf, 0xa3) || ascii(head, 0, 4) === "RIFF" || ascii(head, 0, 3) === "FLV" || starts(0x30, 0x26, 0xb2, 0x75) || ascii(head, 0, 4) === "OggS" || starts(0x47)) {
    return "other_video";
  }
  return "not_video";
}

const DEFAULT_TIMEOUT_MS = 60_000;

/** Starts the program with its arguments as a list, and stops it if it runs past the time allowed. */
const spawn =
  (timeoutMs: number): Runner =>
  async (program, args) => {
    const child = Bun.spawn([program, ...args], { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    try {
      const stdout = new Uint8Array(await new Response(child.stdout).arrayBuffer());
      return { code: await child.exited, stdout };
    } finally {
      clearTimeout(timer);
    }
  };

/** The first bytes of the file at an address. */
async function firstBytes(address: string): Promise<Uint8Array> {
  const response = await fetch(address, { headers: { range: "bytes=0-15" } });
  if (!response.ok) throw new Error("The stored file could not be read");
  return new Uint8Array(await response.arrayBuffer()).slice(0, 16);
}

export function createFfmpegMedia(config: { run?: Runner; head?: (address: string) => Promise<Uint8Array>; timeoutMs?: number } = {}): Media {
  const run = config.run ?? spawn(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const head = config.head ?? firstBytes;

  return {
    async probe(address) {
      const kind = sniff(await head(address));
      if (kind === "not_video") return "unreadable";
      if (kind === "other_video") return { format: "other", durationSec: 0 };

      const { code, stdout } = await run("ffprobe", [
        "-v", "error",
        ...SAFE_INPUT,
        "-show_entries", "format=duration:format_tags=major_brand:stream=codec_type",
        "-of", "json",
        address,
      ]);
      if (code !== 0) return "unreadable";
      let found: { format?: { duration?: string; tags?: { major_brand?: string } }; streams?: { codec_type?: string }[] };
      try {
        found = JSON.parse(new TextDecoder().decode(stdout));
      } catch {
        return "unreadable";
      }
      const durationSec = Number(found.format?.duration);
      const hasVideo = (found.streams ?? []).some((stream) => stream.codec_type === "video");
      if (!hasVideo || !Number.isFinite(durationSec) || durationSec <= 0) return "unreadable";
      // QuickTime's own brand marks a MOV. Every other brand in this family is an MP4.
      return { format: found.format?.tags?.major_brand?.trim() === "qt" ? "mov" : "mp4", durationSec };
    },

    async frames(address, timesSec) {
      const frames: Uint8Array[] = [];
      for (const time of timesSec) {
        const { code, stdout } = await run("ffmpeg", [
          "-v", "error",
          ...SAFE_INPUT,
          "-ss", String(Math.max(0, time)),
          "-i", address,
          "-frames:v", "1",
          // Small enough to send as an image, never larger than the video itself.
          "-vf", "scale='min(1280,iw)':-2",
          "-f", "image2pipe",
          "-vcodec", "mjpeg",
          "-q:v", "4",
          "-",
        ]);
        if (code !== 0 || stdout.byteLength === 0) throw new Error("A frame could not be cut from the video");
        frames.push(stdout);
      }
      return frames;
    },
  };
}
