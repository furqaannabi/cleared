import { describe, expect, test } from "vitest";
import { fromCheck, fromAnswer } from "./upload-problem";

describe("DC-FR-45, DC-FR-53 (1.18) what the page says when a draft can't go", () => {
  test("checked before sending: over 1 GB, the wrong format, too long", () => {
    expect(fromCheck({ kind: "too_big", size: 3.4 * 1024 ** 3 }, "master.mov")).toEqual({
      show: "file",
      heading: "This file is over 1 GB.",
      body: "master.mov is 3.4 GB. Export a smaller file and upload it again. Nothing was sent.",
    });
    expect(fromCheck({ kind: "format" }, "cut.webm")).toEqual({ show: "file", heading: "We couldn’t check cut.webm", body: "We can’t check cut.webm in this format. Upload an MP4 or MOV." });
    expect(fromCheck({ kind: "too_long", lengthSec: 1020, lengthCapSec: 900 }, "cut.mp4")).toEqual({
      show: "file",
      heading: "We couldn’t check cut.mp4",
      body: "cut.mp4 is 17:00 long, and drafts can be up to 15:00.",
    });
  });

  test("the API's file refusals read the same, with its length and cap", () => {
    expect(fromAnswer({ ok: false, error: "rejected", code: "file_too_large" }, "a.mp4")).toMatchObject({ show: "file", heading: "This file is over 1 GB." });
    expect(fromAnswer({ ok: false, error: "rejected", code: "file_too_long", file: { lengthSec: 960, lengthCapSec: 900 } }, "a.mp4")).toMatchObject({
      body: "a.mp4 is 16:00 long, and drafts can be up to 15:00.",
    });
    expect(fromAnswer({ ok: false, error: "rejected", code: "file_unreadable" }, "a.mp4")).toMatchObject({ body: "We couldn’t read a.mp4; the file may be damaged." });
    expect(fromAnswer({ ok: false, error: "rejected", code: "file_format" }, "a.mp4")).toMatchObject({ show: "file" });
  });

  test("the post's limit hides uploading; the daily one says when", () => {
    const at = new Date();
    at.setHours(15, 40, 0, 0);
    expect(fromAnswer({ ok: false, error: "draft_limit", limit: { field: "post" } }, "a.mp4")).toEqual({
      show: "limit",
      post: true,
      heading: "This post has had all the checks one post can have.",
      body: "So this draft can’t be checked. Your last results stay as they are.",
    });
    expect(fromAnswer({ ok: false, error: "draft_limit", limit: { field: "overall", resetsAt: at.toISOString() } }, "a.mp4")).toEqual({
      show: "limit",
      post: false,
      heading: "Cleared has checked all the video it can today.",
      body: "You can upload this draft from 3:40 pm.",
    });
    expect(fromAnswer({ ok: false, error: "draft_limit", limit: { field: "overall" } }, "a.mp4")).toMatchObject({ body: "You can upload this draft tomorrow." });
  });

  test("a post that moved on reloads; Cancel says nothing; anything else asks to try again", () => {
    expect(fromAnswer({ ok: false, error: "rejected", code: "check_running" }, "a.mp4")).toEqual({ show: "reload" });
    expect(fromAnswer({ ok: false, error: "cancelled" }, "a.mp4")).toEqual({ show: "nothing" });
    expect(fromAnswer({ ok: false, error: "unavailable" }, "a.mp4")).toEqual({ show: "failed", message: "We couldn’t send your draft. Try again." });
  });
});
