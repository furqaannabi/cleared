/**
 * The media port over a stand-in for running ffprobe and ffmpeg (draft check and review spec DR-FR-03,
 * DR-FR-19). Against the real programs it is not yet proven: they are not installed here.
 */
import { describe, expect, test } from "bun:test";
import { createFfmpegMedia, sniff, type Runner } from "./ffmpeg";

const bytes = (text: string) => new TextEncoder().encode(text);
const MP4_HEAD = new Uint8Array([0, 0, 0, 0x20, ...bytes("ftypisom"), 0, 0, 2, 0]);
const ADDRESS = "https://bucket.test/drafts/p/d?signature=abc";

/** A stand-in that remembers what it was asked to run and answers what the test says. */
function standIn(answers: { ffprobe?: { code?: number; json?: unknown; text?: string }; ffmpeg?: { code?: number; bytes?: Uint8Array }; head?: Uint8Array } = {}) {
  const ran: { program: string; args: string[] }[] = [];
  const run: Runner = async (program, args) => {
    ran.push({ program, args });
    if (program === "ffprobe") {
      const text = answers.ffprobe?.text ?? JSON.stringify(answers.ffprobe?.json ?? { format: { duration: "61.5", tags: { major_brand: "isom" } }, streams: [{ codec_type: "video" }, { codec_type: "audio" }] });
      return { code: answers.ffprobe?.code ?? 0, stdout: bytes(text) };
    }
    return { code: answers.ffmpeg?.code ?? 0, stdout: answers.ffmpeg?.bytes ?? new Uint8Array([0xff, 0xd8, 0xff]) };
  };
  return { ran, media: createFfmpegMedia({ run, head: async () => answers.head ?? MP4_HEAD }) };
}

describe("DR-FR-03 what a file is comes from reading it", () => {
  test("its first bytes say whether it is an MP4 or MOV, another kind of video, or not a video", () => {
    expect(sniff(MP4_HEAD)).toBe("mp4_or_mov");
    expect(sniff(new Uint8Array([0, 0, 0, 8, ...bytes("wide"), 0, 0, 0, 0]))).toBe("mp4_or_mov");
    expect(sniff(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 0, 0, 0]))).toBe("other_video");
    expect(sniff(bytes("RIFF....AVI LIST"))).toBe("other_video");
    expect(sniff(bytes("#EXTM3U\n#EXT-X-VER"))).toBe("not_video");
    expect(sniff(bytes("<html><body>hi</b"))).toBe("not_video");
    expect(sniff(new Uint8Array())).toBe("not_video");
  });

  test("an MP4 is read for its length, and a MOV is told apart by its brand", async () => {
    expect(await standIn().media.probe(ADDRESS)).toEqual({ format: "mp4", durationSec: 61.5 });

    const mov = standIn({ ffprobe: { json: { format: { duration: "12.04", tags: { major_brand: "qt  " } }, streams: [{ codec_type: "video" }] } } });
    expect(await mov.media.probe(ADDRESS)).toEqual({ format: "mov", durationSec: 12.04 });
  });

  test("a file that is not a video is never given to a program at all", async () => {
    for (const head of [bytes("#EXTM3U\n#EXT-X-VERSION:3"), bytes("%PDF-1.7 not a video"), new Uint8Array()]) {
      const { ran, media } = standIn({ head });
      expect(await media.probe(ADDRESS)).toBe("unreadable");
      expect(ran).toEqual([]);
    }
  });

  test("another kind of video is refused for its format without being read further", async () => {
    const { ran, media } = standIn({ head: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 0, 0, 0]) });

    expect(await media.probe(ADDRESS)).toEqual({ format: "other", durationSec: 0 });
    expect(ran).toEqual([]);
  });

  test.each([
    ["ffprobe fails on it", { code: 1 }],
    ["ffprobe prints something that is not its report", { text: "Segmentation fault" }],
    ["it has no video in it", { json: { format: { duration: "30" }, streams: [{ codec_type: "audio" }] } }],
    ["it has no length", { json: { format: {}, streams: [{ codec_type: "video" }] } }],
    ["its length is nothing", { json: { format: { duration: "0.000000" }, streams: [{ codec_type: "video" }] } }],
  ])("a file is unreadable when %s", async (_why, ffprobe) => {
    expect(await standIn({ ffprobe }).media.probe(ADDRESS)).toBe("unreadable");
  });
});

describe("a stranger's file is read narrowly", () => {
  test("both programs are told to read it only as an MP4 or MOV, and only over https", async () => {
    const { ran, media } = standIn();

    await media.probe(ADDRESS);
    await media.frames(ADDRESS, [16]);

    for (const { args } of ran) {
      expect(args.slice(args.indexOf("-f"), args.indexOf("-f") + 2)).toEqual(["-f", "mov"]);
      expect(args.slice(args.indexOf("-protocol_whitelist"), args.indexOf("-protocol_whitelist") + 2)).toEqual(["-protocol_whitelist", "https,tls,tcp"]);
    }
    // For ffmpeg these are options of the input, so they come before it.
    const ffmpeg = ran[1]!.args;
    expect(ffmpeg.indexOf("-f")).toBeLessThan(ffmpeg.indexOf("-i"));
    expect(ffmpeg.indexOf("-protocol_whitelist")).toBeLessThan(ffmpeg.indexOf("-i"));
  });

  test("the address is one argument of its own, exactly as given, so nothing in it is ever read as a command", async () => {
    const odd = "https://bucket.test/a b;rm -rf $(x)&c";
    const { ran, media } = standIn();

    await media.probe(odd);

    expect(ran[0]!.args.at(-1)).toBe(odd);
    expect(ran[0]!.args.filter((arg) => arg.includes("rm -rf"))).toEqual([odd]);
  });
});

describe("DR-FR-19 frames for the second look", () => {
  test("one still image is cut for each moment asked for, at that moment", async () => {
    const { ran, media } = standIn({ ffmpeg: { bytes: new Uint8Array([0xff, 0xd8, 9, 9]) } });

    const frames = await media.frames(ADDRESS, [16, 18.5, 20]);

    expect(frames).toEqual([new Uint8Array([0xff, 0xd8, 9, 9]), new Uint8Array([0xff, 0xd8, 9, 9]), new Uint8Array([0xff, 0xd8, 9, 9])]);
    expect(ran.map(({ program, args }) => [program, args[args.indexOf("-ss") + 1]])).toEqual([
      ["ffmpeg", "16"],
      ["ffmpeg", "18.5"],
      ["ffmpeg", "20"],
    ]);
    expect(ran[0]!.args).toEqual(expect.arrayContaining(["-frames:v", "1", "-vcodec", "mjpeg", "-"]));
  });

  test("a frame that cannot be cut is a failure, never a missing picture passed off as one", async () => {
    await expect(standIn({ ffmpeg: { code: 1 } }).media.frames(ADDRESS, [16])).rejects.toThrow();
    await expect(standIn({ ffmpeg: { bytes: new Uint8Array() } }).media.frames(ADDRESS, [16])).rejects.toThrow();
  });
});
