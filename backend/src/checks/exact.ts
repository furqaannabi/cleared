/**
 * Finds an exact value (a code, a link, a hashtag) in what was said or shown (draft check and review
 * spec DR-FR-13, DR-FR-14). This is fixed code: no model is asked about an exact item (DR-BR-04).
 */
import { moment, runs, tokensOf, words, type Source, type TimedText, type Token } from "./text";

export type ExactFinding =
  /** It is there. `text` is the words as they were said or shown. */
  | { found: "match"; text: string; startSec: number; endSec: number }
  /** Something close is there, but not it. The item is unsure, and this moment is its evidence. */
  | { found: "near"; text: string; startSec: number; endSec: number }
  | { found: "none" };

export interface ExactSettings {
  /** How far apart a value's parts may be said and still count as a near miss (DR-FR-14). */
  nearSpanSec: number;
  /** A value shorter than this has no one-character near miss: too many things are one character away. */
  nearMinLength: number;
}

export const defaultExactSettings: ExactSettings = { nearSpanSec: 5, nearMinLength: 4 };

/** Whether two texts differ by exactly one character: one changed, one missing or one extra. */
function oneAway(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let at = 0;
  while (at < short.length && short[at] === long[at]) at++;
  // Skip the one character that differs, then the rest must be the same.
  return short.slice(short.length === long.length ? at + 1 : at) === long.slice(at + 1);
}

/** A value's parts: its words, each split where letters meet digits. "GLOW20" is "glow" then "20". */
const partsOf = (value: string) => words(value).flatMap((word) => word.match(/\p{N}+|[^\p{N}]+/gu) ?? []);

/**
 * The value's parts, each as a whole token and in order, starting and ending within the span allowed.
 * They are near each other but were not said together, or it would have been a match.
 */
function partsNearby(parts: string[], list: Token[], spanSec: number): Token[] | undefined {
  for (const [first, start] of list.entries()) {
    if (start.norm !== parts[0]) continue;
    const found = [start];
    let from = first + 1;
    for (const part of parts.slice(1)) {
      const next = list.findIndex((token, index) => index >= from && token.norm === part && token.endSec - start.startSec <= spanSec);
      if (next === -1) break;
      found.push(list[next]!);
      from = next + 1;
    }
    if (found.length === parts.length) return found;
  }
  return undefined;
}

/**
 * Looks for `value` in the material. A match is the value itself after normalising. A near miss is
 * something one character away, or the value's parts close together in time but apart. The earliest
 * match is reported; a near miss only if there is no match anywhere.
 */
export function findExact(value: string, material: TimedText[], from: Source, settings: ExactSettings = defaultExactSettings): ExactFinding {
  const target = words(value).join("");
  if (!target) return { found: "none" };
  const list = tokensOf(material, from);

  const candidates = runs(list, from, Math.max(1, target.length - 1), target.length + 1);
  const match = candidates.find((run) => run.norm === target);
  if (match) return { found: "match", ...moment(match.tokens) };

  if (target.length >= settings.nearMinLength) {
    const close = candidates.find((run) => oneAway(run.norm, target));
    if (close) return { found: "near", ...moment(close.tokens) };
  }

  const parts = partsOf(value);
  if (parts.length > 1) {
    const apart = partsNearby(parts, list, settings.nearSpanSec);
    if (apart) return { found: "near", ...moment(apart), text: apart.map((token) => token.text).join(" … ") };
  }
  return { found: "none" };
}
