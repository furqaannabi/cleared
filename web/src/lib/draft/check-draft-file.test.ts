import { describe, expect, test } from "vitest";
import { checkDraftFile, MAX_DRAFT_BYTES, MAX_DRAFT_SECONDS } from "./check-draft-file";

const GB = 1024 ** 3;
const mp4 = (size = 400 * 1024 ** 2) => ({ name: "cut3.mp4", type: "video/mp4", size });

describe("DC-FR-45 (1.18) a draft file, checked before it is sent", () => {
  test("an MP4 or MOV within 1 GB and 15 minutes goes", () => {
    expect(checkDraftFile(mp4(), 408)).toEqual({ ok: true });
    expect(checkDraftFile({ name: "cut3.MOV", type: "video/quicktime", size: GB }, 900)).toEqual({ ok: true });
    expect(MAX_DRAFT_BYTES).toBe(GB);
    expect(MAX_DRAFT_SECONDS).toBe(900);
  });

  test("another type is the wrong format, by type or by extension", () => {
    expect(checkDraftFile({ name: "cut3.webm", type: "video/webm", size: 10 }, null)).toEqual({ ok: false, problem: { kind: "format" } });
    expect(checkDraftFile({ name: "notes.pdf", type: "", size: 10 }, null)).toEqual({ ok: false, problem: { kind: "format" } });
    expect(checkDraftFile({ name: "cut3.mov", type: "", size: 10 }, null)).toEqual({ ok: true });
  });

  test("over 1 GB", () => {
    expect(checkDraftFile(mp4(GB + 1), 60)).toEqual({ ok: false, problem: { kind: "too_big", size: GB + 1 } });
  });

  test("longer than 15 minutes, with its length and the cap; a length the browser can't read is left to the API", () => {
    expect(checkDraftFile(mp4(), 901)).toEqual({ ok: false, problem: { kind: "too_long", lengthSec: 901, lengthCapSec: 900 } });
    expect(checkDraftFile(mp4(), null)).toEqual({ ok: true });
  });
});
