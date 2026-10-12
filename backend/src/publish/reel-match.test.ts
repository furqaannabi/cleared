/**
 * Whether a live Reel is the approved draft (Instagram Reels spec IG-FR-21, IG-BR-04, IG-BR-06): fixed
 * code over two lengths and two readings of what was said. No model decides it.
 */
import { describe, expect, test } from "bun:test";
import type { TimedText } from "../checks/text";
import { matchReel } from "./reel-match";

/** Speech of `count` different words, as one piece. `change` swaps some of them for other words. */
const spoken = (count: number, change: (word: string, index: number) => string = (word) => word): TimedText[] => [
  { text: Array.from({ length: count }, (_, index) => change(`word${index}x`, index)).join(" "), startSec: 0, endSec: 30 },
];
const draft = (words = 40) => ({ durationSec: 30, speech: spoken(words) });
/** The same speech with the first `n` words said differently. */
const withChanged = (n: number, words = 40) => spoken(words, (word, index) => (index < n ? `other${index}y` : word));

describe("IG-FR-21 the live Reel is the approved draft", () => {
  test("the same length and the same words", () => {
    expect(matchReel(draft(), { durationSec: 30, speech: spoken(40) })).toEqual({ match: "same" });
  });

  test("Instagram re-encodes every upload: a length up to 2 seconds off is still the same", () => {
    expect(matchReel(draft(), { durationSec: 32, speech: spoken(40) })).toEqual({ match: "same" });
    expect(matchReel(draft(), { durationSec: 28, speech: spoken(40) })).toEqual({ match: "same" });
  });

  test("a second reading mishears a few words: 90% of the draft's words, in order, is enough", () => {
    expect(matchReel(draft(), { durationSec: 30, speech: withChanged(4) })).toEqual({ match: "same" });
  });

  test("words are compared as the draft check compares them: case, punctuation and number words do not matter", () => {
    const said = "Hi everyone, today's video is sponsored by Glow Serum. I have used it every morning for two weeks now, and you can use code GLOW twenty for twenty percent off.";
    const heard = "hi everyone todays video is sponsored by glow serum i have used it every morning for 2 weeks now and you can use code glow 20 for 20 percent off";

    expect(matchReel({ durationSec: 12, speech: [{ text: said, startSec: 0, endSec: 12 }] }, { durationSec: 12.4, speech: [{ text: heard, startSec: 0, endSec: 12 }] })).toEqual({ match: "same" });
  });

  test("how the reading is cut into pieces does not matter", () => {
    const pieces = spoken(40)[0]!.text.split(" ");
    const inTwo: TimedText[] = [
      { text: pieces.slice(0, 15).join(" "), startSec: 0, endSec: 10 },
      { text: pieces.slice(15).join(" "), startSec: 10, endSec: 30 },
    ];

    expect(matchReel(draft(), { durationSec: 30, speech: inTwo })).toEqual({ match: "same" });
  });
});

describe("IG-FR-21 the live Reel is not the approved file", () => {
  test("a length more than 2 seconds off, whatever was said", () => {
    expect(matchReel(draft(), { durationSec: 32.1, speech: spoken(40) })).toEqual({ match: "different", because: "length" });
    expect(matchReel(draft(), { durationSec: 27.9, speech: spoken(40) })).toEqual({ match: "different", because: "length" });
  });

  test("under half of the draft's words are there", () => {
    expect(matchReel(draft(), { durationSec: 30, speech: withChanged(21) })).toEqual({ match: "different", because: "words" });
  });

  test("the same words in another order are not the same video", () => {
    const backwards: TimedText[] = [{ text: spoken(40)[0]!.text.split(" ").reverse().join(" "), startSec: 0, endSec: 30 }];

    expect(matchReel(draft(), { durationSec: 30, speech: backwards })).toEqual({ match: "different", because: "words" });
  });

  test("nothing is said in the live Reel, where the draft had speech", () => {
    expect(matchReel(draft(), { durationSec: 30, speech: [] })).toEqual({ match: "different", because: "words" });
  });
});

describe("IG-FR-21, IG-BR-06 what cannot be decided", () => {
  test("between half and 90% of the words: not clearly the same, not clearly another video", () => {
    expect(matchReel(draft(), { durationSec: 30, speech: withChanged(5) })).toEqual({ match: "unknown", because: "unclear" });
    expect(matchReel(draft(), { durationSec: 30, speech: withChanged(20) })).toEqual({ match: "unknown", because: "unclear" });
  });

  test("a draft with fewer than 20 spoken words has too little to compare", () => {
    expect(matchReel(draft(19), { durationSec: 30, speech: spoken(19) })).toEqual({ match: "unknown", because: "too_little_speech" });
    expect(matchReel({ durationSec: 30, speech: [] }, { durationSec: 30, speech: [] })).toEqual({ match: "unknown", because: "too_little_speech" });
    expect(matchReel(draft(20), { durationSec: 30, speech: spoken(20) })).toEqual({ match: "same" });
  });

  test("but a wrong length is a fault that was seen: it is never softened to \"cannot decide\"", () => {
    expect(matchReel(draft(5), { durationSec: 45, speech: spoken(5) })).toEqual({ match: "different", because: "length" });
  });
});

describe("the limits are settings", () => {
  test("a tighter tolerance and a stricter share of words", () => {
    const strict = { toleranceSec: 0.5, sameAt: 0.99, differentBelow: 0.5, minWords: 20 };

    expect(matchReel(draft(), { durationSec: 31, speech: spoken(40) }, strict)).toEqual({ match: "different", because: "length" });
    expect(matchReel(draft(), { durationSec: 30, speech: withChanged(2) }, strict)).toEqual({ match: "unknown", because: "unclear" });
  });
});
