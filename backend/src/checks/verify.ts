/**
 * Verifies what a model claims before it counts (draft check and review spec DR-BR-05 to DR-BR-07,
 * docs/decisions/2026-10-09-how-an-ai-pass-is-verified.md). A model proposes; this fixed code decides.
 * A claim that cannot be verified never becomes a pass: the item is unsure and goes to a person.
 */
import { moment, runs, tokensOf, type Source, type TimedText } from "./text";

export interface VerifySettings {
  /** How far the time a model cites may be from where its quoted words are found (DR-BR-05). */
  quoteToleranceSec: number;
  /** How far past the video's end a cited moment may run and still count as inside: a rounding's worth. */
  endSlackSec: number;
}

export const defaultVerifySettings: VerifySettings = { quoteToleranceSec: 2, endSlackSec: 1 };

/** A stretch of the video a model points at. */
export interface Span {
  startSec: number;
  endSec: number;
}

/** Evidence taken from the video itself: the words as they were said or shown, and when. */
export interface Evidence extends Span {
  text: string;
}

/** Whether a span is a real stretch of this video: it starts at or after zero, does not run backwards, and ends inside it. */
function insideVideo(span: Span, videoSec: number, settings: VerifySettings): boolean {
  return (
    Number.isFinite(span.startSec) &&
    Number.isFinite(span.endSec) &&
    span.startSec >= 0 &&
    span.endSec >= span.startSec &&
    span.endSec <= videoSec + settings.endSlackSec
  );
}

/**
 * The quoted words where they really are, if they were said or shown within the tolerance of the time
 * cited, and that time is inside the video (DR-BR-05). The evidence returned is the video's own words
 * and times, never the model's. Undefined means the claim is not verified.
 */
export function verifyQuote(
  claim: Span & { quote: string },
  material: TimedText[],
  from: Source,
  videoSec: number,
  settings: VerifySettings = defaultVerifySettings,
): Evidence | undefined {
  if (!insideVideo(claim, videoSec, settings)) return undefined;
  // The quote is compared the way the material is, so "twenty" in a quote of speech is "20" on both sides.
  const target = tokensOf([{ text: claim.quote, startSec: 0, endSec: 0 }], from)
    .map((token) => token.norm)
    .join("");
  if (!target) return undefined;

  const earliest = claim.startSec - settings.quoteToleranceSec;
  const latest = claim.endSec + settings.quoteToleranceSec;
  const found = runs(tokensOf(material, from), from, target.length, target.length)
    .filter((run) => run.norm === target)
    .map((run) => moment(run.tokens))
    .find((where) => where.endSec >= earliest && where.startSec <= latest && where.endSec <= videoSec + settings.endSlackSec);
  return found;
}

/** What was said and what was on screen: a quote may come from either. */
export interface Material {
  speech: TimedText[];
  screen: TimedText[];
}

const quoteIn = (claim: Span & { quote: string }, material: Material, videoSec: number, settings: VerifySettings) =>
  verifyQuote(claim, material.speech, "speech", videoSec, settings) ?? verifyQuote(claim, material.screen, "screen", videoSec, settings);

const MINUTES = ["minute", "minutes", "min", "mins"];

/**
 * The limits an item's own wording states, in seconds: "the first 30 seconds" is 30, "within two
 * minutes" is 120, "the first minute" is 60. Wording with no number states none (DR-BR-06).
 */
export function limitsIn(wording: string): number[] {
  const list = tokensOf([{ text: wording, startSec: 0, endSec: 0 }], "speech");
  const limits: number[] = [];
  for (const [at, token] of list.entries()) {
    const inMinutes = MINUTES.includes(list[at + 1]?.norm ?? "");
    if (/^\d+$/.test(token.norm)) limits.push(Number(token.norm) * (inMinutes ? 60 : 1));
    // "a minute", "the first minute": one minute, with no number written before it.
    else if (MINUTES.includes(token.norm) && !/^\d+$/.test(list[at - 1]?.norm ?? "")) limits.push(60);
  }
  return limits;
}

/** The limit a model understood from a timing item: something happens by a time, or lasts at least a time. */
export type TimingLimit = { kind: "by" | "at_least"; seconds: number };

/** What a model returns for a timing item: the limit, the stretch it means, and the words at its start and end. */
export interface TimingClaim extends Span {
  limit: TimingLimit;
  startQuote: string;
  /** The words at the end of a segment. Needed for a limit on how long something lasts. */
  endQuote?: string;
}

export type TimingResult = { status: "passed" | "fix_needed"; evidence: Evidence } | { status: "unsure" };

/**
 * Decides a timing item (DR-FR-17, DR-BR-06). The model only finds the moments. The limit must be a
 * number in the item's own wording, the quoted words must really be there, and then code does the
 * comparison on the video's own times: at or before the limit, or at least as long as it. A limit not
 * in the wording, or words not found, is unsure. A sum that does not hold is fix needed.
 */
export function verifyTiming(
  claim: TimingClaim,
  wording: string,
  material: Material,
  videoSec: number,
  settings: VerifySettings = defaultVerifySettings,
): TimingResult {
  const { limit } = claim;
  if (!(limit.seconds > 0) || !limitsIn(wording).includes(limit.seconds)) return { status: "unsure" };

  if (limit.kind === "by") {
    const mention = quoteIn({ quote: claim.startQuote, startSec: claim.startSec, endSec: claim.endSec }, material, videoSec, settings);
    if (!mention) return { status: "unsure" };
    return { status: mention.startSec <= limit.seconds ? "passed" : "fix_needed", evidence: mention };
  }

  // A segment: the words at its start are looked for at its start, and the words at its end at its end.
  if (!insideVideo(claim, videoSec, settings) || claim.endQuote === undefined) return { status: "unsure" };
  const start = quoteIn({ quote: claim.startQuote, startSec: claim.startSec, endSec: claim.startSec }, material, videoSec, settings);
  const end = quoteIn({ quote: claim.endQuote, startSec: claim.endSec, endSec: claim.endSec }, material, videoSec, settings);
  if (!start || !end || end.endSec < start.startSec) return { status: "unsure" };
  const evidence = { text: `${start.text} … ${end.text}`, startSec: start.startSec, endSec: end.endSec };
  return { status: evidence.endSec - evidence.startSec >= limit.seconds ? "passed" : "fix_needed", evidence };
}

/** What the second look answers about frames from the moment a shown item was said to be visible. */
export type SecondLook = "yes" | "no" | "cannot_tell";

/**
 * Whether a shown pass counts (DR-BR-07): the moment the video model cited is inside the video, and
 * the second look at frames from it says yes. Anything else leaves the item unsure.
 */
export function verifyShown(claim: Span, secondLook: SecondLook, videoSec: number, settings: VerifySettings = defaultVerifySettings): boolean {
  return insideVideo(claim, videoSec, settings) && secondLook === "yes";
}

/**
 * The moments to cut still frames at for the second look (DR-FR-19): the start, the middle and the end
 * of the stretch cited, to a tenth of a second, and never past the video's last moment.
 */
export function frameTimes(claim: Span, videoSec: number): number[] {
  const last = Math.max(0, videoSec - 0.1);
  const tenth = (seconds: number) => Math.round(Math.min(Math.max(seconds, 0), last) * 10) / 10;
  return [...new Set([claim.startSec, (claim.startSec + claim.endSec) / 2, claim.endSec].map(tenth))];
}
