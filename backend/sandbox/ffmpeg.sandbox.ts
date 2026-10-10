/**
 * The media port against the real ffprobe and ffmpeg (draft check and review spec DR-FR-03, DR-FR-19).
 * Run with `pnpm test:ffmpeg`. It is not part of `pnpm test`, because it needs ffmpeg installed.
 *
 * It makes a few small files with ffmpeg itself and reads them from disk. The service reads files over
 * https only; this check allows local files so that it needs no bucket. Everything else is the real
 * adapter: the same arguments, the same parsing.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFfmpegMedia } from "../src/media/ffmpeg";

let folder: string;
const file = (name: string) => join(folder, name);
const media = createFfmpegMedia({ protocols: "file", head: async (address) => new Uint8Array(await Bun.file(address).slice(0, 16).arrayBuffer()) });

/** Makes a five-second test picture with a tone, in the container the file's name asks for. */
async function make(name: string, ...extra: string[]) {
  const child = Bun.spawn(
    ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=duration=5:size=640x360:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:duration=5", "-c:v", "mpeg4", "-c:a", "aac", "-shortest", ...extra, file(name)],
    { stdout: "ignore", stderr: "pipe" },
  );
  if ((await child.exited) !== 0) throw new Error(`ffmpeg could not make ${name}: ${await new Response(child.stderr).text()}`);
}

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), "cleared-ffmpeg-"));
  await make("clip.mp4");
  await make("clip.mov");
  await make("clip.mkv");
  await make("sound-only.mp4", "-vn");
  await Bun.write(file("notes.mp4"), "These are my notes, saved with a video's name.\n".repeat(20));
  // A playlist that names a local file, saved as an MP4. A program that trusted it would go and read that file.
  await Bun.write(file("playlist.mp4"), "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:10.0,\nfile:///etc/passwd\n#EXT-X-ENDLIST\n");
  // The first bytes of an MP4, then rubbish.
  await Bun.write(file("broken.mp4"), new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, ...new Array(4000).fill(0x5a)]));
}, 60_000);

afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe("DR-FR-03 what a file is, read by the real ffprobe", () => {
  test("an MP4 is an MP4 of five seconds", async () => {
    const found = await media.probe(file("clip.mp4"));

    expect(found).toMatchObject({ format: "mp4" });
    expect((found as { durationSec: number }).durationSec).toBeCloseTo(5, 0);
  });

  test("a MOV is told apart from an MP4", async () => {
    expect(await media.probe(file("clip.mov"))).toMatchObject({ format: "mov" });
  });

  test("another kind of video is refused for its format", async () => {
    expect(await media.probe(file("clip.mkv"))).toEqual({ format: "other", durationSec: 0 });
  });

  test("a file with sound and no picture is not a video", async () => {
    expect(await media.probe(file("sound-only.mp4"))).toBe("unreadable");
  });

  test("text saved with a video's name, a playlist dressed as an MP4, and an MP4 that is rubbish inside are all unreadable", async () => {
    expect(await media.probe(file("notes.mp4"))).toBe("unreadable");
    expect(await media.probe(file("playlist.mp4"))).toBe("unreadable");
    expect(await media.probe(file("broken.mp4"))).toBe("unreadable");
  });
});

describe("DR-FR-19 frames cut by the real ffmpeg", () => {
  test("one JPEG for each moment asked for, from an MP4 and from a MOV", async () => {
    for (const name of ["clip.mp4", "clip.mov"]) {
      const frames = await media.frames(file(name), [0, 2.5, 4.9]);

      expect(frames).toHaveLength(3);
      for (const frame of frames) {
        // Every JPEG starts with these two bytes, and a real picture of this size is a few kilobytes.
        expect([frame[0], frame[1]]).toEqual([0xff, 0xd8]);
        expect(frame.byteLength).toBeGreaterThan(2_000);
      }
      // The test picture changes as it plays, so frames from different moments differ.
      expect(Buffer.from(frames[0]!).equals(Buffer.from(frames[1]!))).toBe(false);
    }
  });

  test("a moment past the end of the video gives no frame, which is a failure and never an empty picture", async () => {
    await expect(media.frames(file("clip.mp4"), [60])).rejects.toThrow();
  });
});
