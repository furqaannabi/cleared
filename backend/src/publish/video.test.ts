/** A video's link and its file (publish to paid spec PT-FR-01, PT-FR-02, PT-FR-04). Pure code, no YouTube. */
import { describe, expect, test } from "bun:test";
import { sameFile, videoIdFrom } from "./video";

describe("PT-FR-01 the video's id is taken from its link by code", () => {
  test.each([
    ["a watch link", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["a watch link with other parameters", "https://www.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ&t=42s"],
    ["a watch link without www", "https://youtube.com/watch?v=dQw4w9WgXcQ"],
    ["a phone link", "https://m.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["a short link", "https://youtu.be/dQw4w9WgXcQ"],
    ["a short link with a share code", "https://youtu.be/dQw4w9WgXcQ?si=AbCdEf123"],
    ["a Shorts link", "https://www.youtube.com/shorts/dQw4w9WgXcQ"],
    ["a link copied from YouTube Studio", "https://studio.youtube.com/video/dQw4w9WgXcQ/edit"],
    ["a link with spaces around it", "  https://youtu.be/dQw4w9WgXcQ \n"],
  ])("%s gives the id", (_what, link) => {
    expect(videoIdFrom(link)).toBe("dQw4w9WgXcQ");
  });

  test.each([
    ["text that is not a link", "my new video"],
    ["nothing", ""],
    ["a bare id", "dQw4w9WgXcQ"],
    ["a link to another site", "https://vimeo.com/123456789"],
    ["another site dressed as YouTube", "https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ"],
    ["another site with YouTube before an at sign", "https://youtube.com@evil.example/watch?v=dQw4w9WgXcQ"],
    ["another site with YouTube in its path", "https://evil.example/youtu.be/dQw4w9WgXcQ"],
    ["a link that is not https", "http://www.youtube.com/watch?v=dQw4w9WgXcQ"],
    ["a script", "javascript:alert('https://youtu.be/dQw4w9WgXcQ')"],
    ["a channel's page", "https://www.youtube.com/@samrivera"],
    ["a playlist", "https://www.youtube.com/playlist?list=PL1234567890"],
    ["a watch link with no video", "https://www.youtube.com/watch?list=PL1234567890"],
    ["an id that is too short", "https://youtu.be/dQw4w9WgXc"],
    ["an id that is too long", "https://youtu.be/dQw4w9WgXcQQ"],
    ["an id with characters no id has", "https://youtu.be/dQw4w9WgX<Q"],
    ["a link far too long to be one", `https://youtu.be/dQw4w9WgXcQ?x=${"a".repeat(3000)}`],
  ])("%s gives nothing", (_what, link) => {
    expect(videoIdFrom(link)).toBeUndefined();
  });
});

describe("PT-FR-02 the video's file must be the approved draft's", () => {
  const draft = { sizeBytes: 84_512_337n, durationSec: 61.52 };

  test("the same size, and the same length to within a second, is the same file", () => {
    expect(sameFile(draft, { fileSizeBytes: 84_512_337, durationSec: 61.52 })).toBe("same");
    expect(sameFile(draft, { fileSizeBytes: 84_512_337, durationSec: 62 })).toBe("same");
    expect(sameFile(draft, { fileSizeBytes: 84_512_337, durationSec: 60.52 })).toBe("same");
  });

  test("one byte more or less is a different file", () => {
    expect(sameFile(draft, { fileSizeBytes: 84_512_338, durationSec: 61.52 })).toBe("different");
    expect(sameFile(draft, { fileSizeBytes: 84_512_336, durationSec: 61.52 })).toBe("different");
  });

  test("a length more than a second off is a different file, even at the same size", () => {
    expect(sameFile(draft, { fileSizeBytes: 84_512_337, durationSec: 63 })).toBe("different");
    expect(sameFile(draft, { fileSizeBytes: 84_512_337, durationSec: 60 })).toBe("different");
  });

  test("a very large file is compared exactly, not as a rounded number", () => {
    const big = { sizeBytes: 9_007_199_254_740_993n, durationSec: 900 };

    expect(sameFile(big, { fileSizeBytes: 9_007_199_254_740_993n, durationSec: 900 })).toBe("same");
    expect(sameFile(big, { fileSizeBytes: 9_007_199_254_740_992n, durationSec: 900 })).toBe("different");
  });
});

describe("PT-FR-04 when YouTube will not say", () => {
  const draft = { sizeBytes: 84_512_337n, durationSec: 61.52 };

  test("with no file record at all, the match is unknown", () => {
    expect(sameFile(draft, {})).toBe("unknown");
  });

  test("with only part of the record, a part that differs is still a different file", () => {
    expect(sameFile(draft, { durationSec: 300 })).toBe("different");
    expect(sameFile(draft, { fileSizeBytes: 1_000 })).toBe("different");
  });

  test("with only part of the record, a part that agrees is not enough to call it the same", () => {
    expect(sameFile(draft, { durationSec: 61.5 })).toBe("unknown");
    expect(sameFile(draft, { fileSizeBytes: 84_512_337 })).toBe("unknown");
  });
});
