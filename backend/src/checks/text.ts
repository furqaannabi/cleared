/**
 * Text with the time it was said or shown, and how it is compared (draft check and review spec
 * DR-FR-12, DR-FR-13). Comparing ignores case, spaces and punctuation, and for speech turns number
 * words into digits, so "glow twenty" and "GLOW-20" are both "glow20". Everything here is untrusted
 * material from a video: it is compared, never obeyed (DR-BR-09).
 */

/** A piece of speech or of on-screen text, and when it starts and ends in the video. */
export interface TimedText {
  text: string;
  startSec: number;
  endSec: number;
}

/** Where the material came from. Number words become digits only in speech. */
export type Source = "speech" | "screen";

/** One word, or one number, of the material: how it compares, how it read, and when. */
export interface Token {
  norm: string;
  text: string;
  startSec: number;
  endSec: number;
  /** Which piece of the material it came from, and where in that piece's text it starts and ends. */
  piece: number;
  from: number;
  to: number;
  /** That piece's text, so evidence can quote it as it was, punctuation included. */
  source: string;
}

const WORD = /[\p{L}\p{N}]+/gu;

const UNITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

const unit = (word: string | undefined) => (word === undefined ? -1 : UNITS.indexOf(word));
const tens = (word: string | undefined) => (word === undefined || word === "" ? -1 : TENS.indexOf(word) * 10);

/** How a piece of text compares: lower case, with only its letters and digits kept, as separate words. */
export function words(text: string): string[] {
  return text.normalize("NFKC").toLowerCase().match(WORD) ?? [];
}

/**
 * A number under a hundred that starts at `at`, and how many words it took: "twenty five" is 25 in two
 * words, "fifteen" is 15 in one. Undefined if no number starts there.
 */
function small(list: Token[], at: number): { value: number; took: number } | undefined {
  const ten = tens(list[at]?.norm);
  if (ten > 0) {
    const one = unit(list[at + 1]?.norm);
    return one >= 1 && one <= 9 ? { value: ten + one, took: 2 } : { value: ten, took: 1 };
  }
  const one = unit(list[at]?.norm);
  return one >= 0 ? { value: one, took: 1 } : undefined;
}

/** Joins several words of the material into one token that spans them. */
function joined(list: Token[], norm: string): Token {
  const first = list[0]!;
  const last = list[list.length - 1]!;
  // A number is only ever joined from words of one piece that follow each other.
  const samePiece = last.piece === first.piece;
  return {
    ...first,
    norm,
    text: samePiece ? first.source.slice(first.from, last.to) : list.map((token) => token.text).join(" "),
    endSec: last.endSec,
    to: samePiece ? last.to : first.to,
  };
}

/** Turns number words into digits: "twenty" is "20", "two zero" is "2" then "0", "one hundred and five" is "105". */
function numbersAsDigits(list: Token[]): Token[] {
  const out: Token[] = [];
  for (let at = 0; at < list.length; ) {
    const number = small(list, at);
    if (!number) {
      out.push(list[at]!);
      at += 1;
      continue;
    }
    let { value, took } = number;
    if (value >= 1 && value <= 9 && list[at + took]?.norm === "hundred") {
      value *= 100;
      took += 1;
      const and = list[at + took]?.norm === "and" ? 1 : 0;
      const rest = small(list, at + took + and);
      if (rest) {
        value += rest.value;
        took += and + rest.took;
      }
    }
    out.push(joined(list.slice(at, at + took), String(value)));
    at += took;
  }
  return out;
}

/** The material as tokens, in the order it was said or shown. */
export function tokensOf(material: TimedText[], from: Source): Token[] {
  const list = material.flatMap((piece, index) => {
    const source = piece.text.normalize("NFKC");
    return [...source.matchAll(WORD)].map((found) => ({
      norm: found[0].toLowerCase(),
      text: found[0],
      startSec: piece.startSec,
      endSec: piece.endSec,
      piece: index,
      from: found.index,
      to: found.index + found[0].length,
      source,
    }));
  });
  return from === "speech" ? numbersAsDigits(list) : list;
}

/** A run of tokens that were said or shown one after another, with nothing between them. */
export interface Run {
  /** The run as it compares: its tokens joined with nothing between. */
  norm: string;
  tokens: Token[];
}

/**
 * Every run of whole tokens whose joined length is from `min` to `max` characters. Speech runs on from
 * one piece to the next; text on screen does not, because two pieces of it are two separate things.
 */
export function runs(list: Token[], from: Source, min: number, max: number): Run[] {
  const found: Run[] = [];
  for (let start = 0; start < list.length; start++) {
    let norm = "";
    for (let end = start; end < list.length; end++) {
      if (from === "screen" && list[end]!.piece !== list[start]!.piece) break;
      norm += list[end]!.norm;
      if (norm.length > max) break;
      if (norm.length >= min) found.push({ norm, tokens: list.slice(start, end + 1) });
    }
  }
  return found;
}

/** A run as evidence: the words as they were said or shown, and when. */
export function moment(run: Token[]): { text: string; startSec: number; endSec: number } {
  // Quoted piece by piece, each as it was written, so a link keeps its dots and slashes.
  const quotes: string[] = [];
  for (let at = 0; at < run.length; ) {
    let end = at;
    while (run[end + 1]?.piece === run[at]!.piece) end++;
    quotes.push(run[at]!.source.slice(run[at]!.from, run[end]!.to));
    at = end + 1;
  }
  return {
    text: quotes.join(" "),
    startSec: Math.min(...run.map((token) => token.startSec)),
    endSec: Math.max(...run.map((token) => token.endSec)),
  };
}
