/**
 * Whether a live Reel is the approved draft (Instagram Reels spec IG-FR-21;
 * docs/decisions/2026-10-11-a-live-reel-is-matched-by-length-then-words.md). Instagram re-encodes every
 * upload, so the file's size says nothing. What is compared is the length, and what was said: the
 * draft's spoken words, in order, as read from each video. Pure code with stated limits: no model
 * decides it (IG-BR-04). What was said is untrusted material: it is compared, never obeyed (IG-BR-09).
 */
import { tokensOf, type TimedText } from "../checks/text";

export interface MatchSettings {
  /** How far the live Reel's length may be from the draft's, in seconds. */
  toleranceSec: number;
  /** The share of the draft's words that must be in the live Reel, in order, for it to be the same video. */
  sameAt: number;
  /** Under this share it is another video. Between the two it cannot be decided. */
  differentBelow: number;
  /** A draft with fewer spoken words than this has too little to compare. */
  minWords: number;
}

export const defaultMatchSettings: MatchSettings = { toleranceSec: 2, sameAt: 0.9, differentBelow: 0.5, minWords: 20 };

export type ReelMatch =
  | { match: "same" }
  /** Not the approved file: a fault that was seen. It is never softened to "unknown" (IG-BR-06). */
  | { match: "different"; because: "length" | "words" }
  | { match: "unknown"; because: "too_little_speech" | "unclear" };

/** One video as the match sees it: its length, and what was said in it. */
export interface Heard {
  durationSec: number;
  speech: TimedText[];
}

/** The words of a reading as they compare (DR-FR-13): lower case, no punctuation, number words as digits. */
const wordsOf = (speech: TimedText[]) => tokensOf(speech, "speech").map((token) => token.norm);

/** How many of `first`'s words are in `second` in the same order: the longest run they share, gaps allowed. */
function inOrder(first: string[], second: string[]): number {
  let above = new Array<number>(second.length + 1).fill(0);
  for (const word of first) {
    const row = new Array<number>(second.length + 1).fill(0);
    for (let at = 1; at <= second.length; at++) {
      row[at] = word === second[at - 1] ? above[at - 1]! + 1 : Math.max(above[at]!, row[at - 1]!);
    }
    above = row;
  }
  return above[second.length]!;
}

export function matchReel(draft: Heard, live: Heard, settings: MatchSettings = defaultMatchSettings): ReelMatch {
  if (Math.abs(live.durationSec - draft.durationSec) > settings.toleranceSec) return { match: "different", because: "length" };

  const said = wordsOf(draft.speech);
  if (said.length < settings.minWords) return { match: "unknown", because: "too_little_speech" };
  const share = inOrder(said, wordsOf(live.speech)) / said.length;
  if (share >= settings.sameAt) return { match: "same" };
  return share < settings.differentBelow ? { match: "different", because: "words" } : { match: "unknown", because: "unclear" };
}
