/** Code verifies every AI pass before it counts (draft check and review spec DR-BR-05 to DR-BR-07). */
import { describe, expect, test } from "bun:test";
import type { TimedText } from "./text";
import { frameTimes, limitsIn, verifyQuote, verifyShown, verifyTiming } from "./verify";

const VIDEO = 300;
const speech: TimedText[] = [
  { text: "Hey everyone, welcome back to the channel.", startSec: 0, endSec: 4 },
  { text: "Today's video is sponsored by Glow Serum.", startSec: 12, endSec: 16 },
  { text: "I've been using it every morning for two weeks.", startSec: 16, endSec: 20 },
  { text: "Use code GLOW20 for twenty percent off.", startSec: 58, endSec: 62 },
  { text: "Thanks again to Glow for sponsoring.", startSec: 70, endSec: 73 },
];
const nothingOnScreen: TimedText[] = [];
const material = { speech, screen: nothingOnScreen };

describe("DR-BR-05 a said or shown-as-text pass counts only if its quote is really there, then", () => {
  test("words that were said at the time cited are verified, and the evidence is the video's own words and times", () => {
    const found = verifyQuote({ quote: "sponsored by glow serum", startSec: 13, endSec: 15 }, speech, "speech", VIDEO);

    expect(found).toEqual({ text: "sponsored by Glow Serum", startSec: 12, endSec: 16 });
  });

  test("the quote is compared as codes are: case, spacing, punctuation and number words do not matter", () => {
    expect(verifyQuote({ quote: "code glow 20 for 20 percent off", startSec: 58, endSec: 62 }, speech, "speech", VIDEO)).toBeDefined();
    expect(verifyQuote({ quote: "Today's video — is sponsored", startSec: 12, endSec: 16 }, speech, "speech", VIDEO)).toBeDefined();
  });

  test("a time up to two seconds off is still verified; further off is not", () => {
    const quote = "sponsored by Glow Serum";

    expect(verifyQuote({ quote, startSec: 17.9, endSec: 18 }, speech, "speech", VIDEO)).toBeDefined();
    expect(verifyQuote({ quote, startSec: 9.9, endSec: 10 }, speech, "speech", VIDEO)).toBeDefined();
    expect(verifyQuote({ quote, startSec: 18.1, endSec: 19 }, speech, "speech", VIDEO)).toBeUndefined();
    expect(verifyQuote({ quote, startSec: 5, endSec: 9.9 }, speech, "speech", VIDEO)).toBeUndefined();
  });

  test("words said twice are verified at the place the time points to", () => {
    const again: TimedText[] = [...speech, { text: "Once more: sponsored by Glow Serum.", startSec: 200, endSec: 204 }];

    expect(verifyQuote({ quote: "sponsored by Glow Serum", startSec: 201, endSec: 203 }, again, "speech", VIDEO)).toMatchObject({ startSec: 200 });
  });

  test("words that were never said are not verified, however sure the claim sounds", () => {
    expect(verifyQuote({ quote: "Glow Serum changed my life", startSec: 12, endSec: 16 }, speech, "speech", VIDEO)).toBeUndefined();
    expect(verifyQuote({ quote: "sponsored by Glow", startSec: 12, endSec: 16 }, [], "speech", VIDEO)).toBeUndefined();
  });

  test("part of a word is not the word", () => {
    expect(verifyQuote({ quote: "sponsor", startSec: 12, endSec: 16 }, speech, "speech", VIDEO)).toBeUndefined();
  });

  test("a time that is not inside the video is not verified, even if the words exist", () => {
    const late: TimedText[] = [{ text: "sponsored by Glow Serum", startSec: 400, endSec: 404 }];

    expect(verifyQuote({ quote: "sponsored by Glow Serum", startSec: 400, endSec: 404 }, late, "speech", VIDEO)).toBeUndefined();
    expect(verifyQuote({ quote: "sponsored by Glow Serum", startSec: -3, endSec: 14 }, speech, "speech", VIDEO)).toBeUndefined();
    expect(verifyQuote({ quote: "sponsored by Glow Serum", startSec: 15, endSec: 13 }, speech, "speech", VIDEO)).toBeUndefined();
    expect(verifyQuote({ quote: "sponsored by Glow Serum", startSec: Number.NaN, endSec: 14 }, speech, "speech", VIDEO)).toBeUndefined();
  });

  test("a quote with no words in it is not verified", () => {
    expect(verifyQuote({ quote: "", startSec: 12, endSec: 16 }, speech, "speech", VIDEO)).toBeUndefined();
    expect(verifyQuote({ quote: " … ", startSec: 12, endSec: 16 }, speech, "speech", VIDEO)).toBeUndefined();
  });

  test("text on screen is quoted from one piece of it, not stitched from two", () => {
    const screen: TimedText[] = [
      { text: "GLOW SERUM", startSec: 13, endSec: 18 },
      { text: "20% OFF", startSec: 13, endSec: 18 },
    ];

    expect(verifyQuote({ quote: "Glow Serum", startSec: 14, endSec: 15 }, screen, "screen", VIDEO)).toEqual({ text: "GLOW SERUM", startSec: 13, endSec: 18 });
    expect(verifyQuote({ quote: "Serum 20% off", startSec: 14, endSec: 15 }, screen, "screen", VIDEO)).toBeUndefined();
  });
});

describe("DR-BR-06 the limit a timing item sets must be a number in its own wording", () => {
  test("seconds and minutes written as figures or as words are read as seconds", () => {
    expect(limitsIn("Mention Glow in the first 30 seconds")).toEqual([30]);
    expect(limitsIn("Make the Glow segment at least forty five seconds long")).toEqual([45]);
    expect(limitsIn("Mention Glow within 2 minutes")).toEqual([120]);
    expect(limitsIn("Mention Glow in the first minute")).toEqual([60]);
    expect(limitsIn("Talk about it for a minute or more")).toEqual([60]);
    expect(limitsIn("Mention it in the first 10 seconds and again after 5 minutes")).toEqual([10, 300]);
  });

  test("wording with no number sets no limit", () => {
    expect(limitsIn("Mention Glow early in the video")).toEqual([]);
    expect(limitsIn("Keep the segment long enough")).toEqual([]);
  });
});

describe("DR-FR-17, DR-BR-06 the AI finds the moments and code does the sum", () => {
  const first30 = "Mention Glow in the first 30 seconds";
  const atLeast45 = "Make the Glow segment at least 45 seconds long";

  test("a mention that starts at or before the limit passes, with the video's own words and time as evidence", () => {
    const claim = { limit: { kind: "by" as const, seconds: 30 }, startSec: 13, endSec: 15, startQuote: "sponsored by Glow Serum" };

    expect(verifyTiming(claim, first30, material, VIDEO)).toEqual({
      status: "passed",
      evidence: { text: "sponsored by Glow Serum", startSec: 12, endSec: 16 },
    });
  });

  test("a mention that is really there but after the limit is fix needed: the sum does not hold", () => {
    const claim = { limit: { kind: "by" as const, seconds: 30 }, startSec: 58, endSec: 62, startQuote: "Use code GLOW20" };

    expect(verifyTiming(claim, first30, material, VIDEO)).toEqual({
      status: "fix_needed",
      evidence: { text: "Use code GLOW20", startSec: 58, endSec: 62 },
    });
  });

  test("the sum is done on where the words really are, not on the time the AI gave", () => {
    // The AI says second 56.5. The words are at second 58.
    const eager = { limit: { kind: "by" as const, seconds: 60 }, startSec: 56.5, endSec: 57, startQuote: "Use code GLOW20" };
    expect(verifyTiming(eager, "Say the code within 60 seconds", material, VIDEO)).toMatchObject({ status: "passed", evidence: { startSec: 58 } });

    const wrong = { limit: { kind: "by" as const, seconds: 57 }, startSec: 56.5, endSec: 57, startQuote: "Use code GLOW20" };
    expect(verifyTiming(wrong, "Say the code within 57 seconds", material, VIDEO)).toMatchObject({ status: "fix_needed" });
  });

  test("a segment at least as long as the limit passes, from where it starts to where it ends", () => {
    const claim = {
      limit: { kind: "at_least" as const, seconds: 45 },
      startSec: 12,
      endSec: 62,
      startQuote: "Today's video is sponsored by Glow Serum",
      endQuote: "for twenty percent off",
    };

    expect(verifyTiming(claim, atLeast45, material, VIDEO)).toEqual({
      status: "passed",
      evidence: { text: "Today's video is sponsored by Glow Serum … for twenty percent off", startSec: 12, endSec: 62 },
    });
  });

  test("a segment shorter than the limit is fix needed", () => {
    const claim = {
      limit: { kind: "at_least" as const, seconds: 45 },
      startSec: 12,
      endSec: 20,
      startQuote: "sponsored by Glow Serum",
      endQuote: "for two weeks",
    };

    expect(verifyTiming(claim, atLeast45, material, VIDEO)).toMatchObject({ status: "fix_needed", evidence: { startSec: 12, endSec: 20 } });
  });

  test("a limit the AI understood that is not a number in the item's wording is unsure, whatever the sum would say", () => {
    const claim = { limit: { kind: "by" as const, seconds: 60 }, startSec: 13, endSec: 15, startQuote: "sponsored by Glow Serum" };

    expect(verifyTiming(claim, first30, material, VIDEO)).toEqual({ status: "unsure" });
    expect(verifyTiming(claim, "Mention Glow early in the video", material, VIDEO)).toEqual({ status: "unsure" });
  });

  test("words the AI quotes that are not there at that time are unsure, never fix needed", () => {
    const invented = { limit: { kind: "by" as const, seconds: 30 }, startSec: 13, endSec: 15, startQuote: "Glow Serum is amazing" };
    const elsewhere = { limit: { kind: "by" as const, seconds: 30 }, startSec: 13, endSec: 15, startQuote: "Use code GLOW20" };

    expect(verifyTiming(invented, first30, material, VIDEO)).toEqual({ status: "unsure" });
    expect(verifyTiming(elsewhere, first30, material, VIDEO)).toEqual({ status: "unsure" });
  });

  test("a segment needs the words at both of its ends: one end alone is unsure", () => {
    const base = { limit: { kind: "at_least" as const, seconds: 45 }, startSec: 12, endSec: 62, startQuote: "sponsored by Glow Serum" };

    expect(verifyTiming(base, atLeast45, material, VIDEO)).toEqual({ status: "unsure" });
    expect(verifyTiming({ ...base, endQuote: "see you next week" }, atLeast45, material, VIDEO)).toEqual({ status: "unsure" });
  });

  test("a limit of nothing, or less, is unsure", () => {
    const claim = { limit: { kind: "by" as const, seconds: 0 }, startSec: 0, endSec: 4, startQuote: "welcome back" };

    expect(verifyTiming(claim, "Mention it in the first 0 seconds", material, VIDEO)).toEqual({ status: "unsure" });
  });

  test("the words can be on screen instead of spoken", () => {
    const onScreen = { speech: [], screen: [{ text: "Sponsored by Glow", startSec: 3, endSec: 9 }] };
    const claim = { limit: { kind: "by" as const, seconds: 30 }, startSec: 3, endSec: 9, startQuote: "sponsored by glow" };

    expect(verifyTiming(claim, first30, onScreen, VIDEO)).toMatchObject({ status: "passed", evidence: { startSec: 3 } });
  });
});

describe("DR-BR-07 a shown pass needs a moment inside the video and a yes from the second look", () => {
  test("a moment inside the video that the second look confirms is verified", () => {
    expect(verifyShown({ startSec: 16, endSec: 20 }, "yes", VIDEO)).toBe(true);
  });

  test("a no, or a cannot tell, from the second look is not verified", () => {
    expect(verifyShown({ startSec: 16, endSec: 20 }, "no", VIDEO)).toBe(false);
    expect(verifyShown({ startSec: 16, endSec: 20 }, "cannot_tell", VIDEO)).toBe(false);
  });

  test("a moment outside the video is not verified, even with a yes", () => {
    expect(verifyShown({ startSec: 310, endSec: 315 }, "yes", VIDEO)).toBe(false);
    expect(verifyShown({ startSec: -1, endSec: 5 }, "yes", VIDEO)).toBe(false);
    expect(verifyShown({ startSec: 20, endSec: 16 }, "yes", VIDEO)).toBe(false);
    expect(verifyShown({ startSec: Number.NaN, endSec: 16 }, "yes", VIDEO)).toBe(false);
  });

  test("a moment that runs a rounding's worth past the end still counts as inside", () => {
    expect(verifyShown({ startSec: 296, endSec: 300.8 }, "yes", VIDEO)).toBe(true);
    expect(verifyShown({ startSec: 296, endSec: 302 }, "yes", VIDEO)).toBe(false);
  });
});

describe("DR-FR-19 the frames the second look is given come from the moment cited", () => {
  test("its start, its middle and its end", () => {
    expect(frameTimes({ startSec: 16, endSec: 20 }, VIDEO)).toEqual([16, 18, 20]);
  });

  test("a moment too short for three different frames gives fewer", () => {
    expect(frameTimes({ startSec: 16, endSec: 16 }, VIDEO)).toEqual([16]);
    expect(frameTimes({ startSec: 16, endSec: 16.1 }, VIDEO)).toEqual([16, 16.1]);
  });

  test("no frame is asked for past the last moment of the video", () => {
    expect(frameTimes({ startSec: 298, endSec: 300.8 }, VIDEO)).toEqual([298, 299.4, 299.9]);
  });
});
