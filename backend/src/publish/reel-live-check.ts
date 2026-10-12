/**
 * A Reel's live check (Instagram Reels spec IG-FR-23, IG-FR-24): from the live Reel's caption and its
 * match to the approved draft, to each item's result and the one answer the money path is given. Pure
 * code: it reads no Instagram and moves nothing. Fixed code decides; a model judges only written items
 * that need judgment, and its pass counts only if its quote is in the caption (IG-BR-04). The caption
 * is untrusted: it is searched and quoted, never obeyed (IG-BR-09).
 *
 * The answers follow the rule already set for YouTube
 * (docs/decisions/2026-10-10-which-live-check-finding-gives-which-answer.md): "cannot decide" is for
 * what Instagram did not show and for a match that is unclear, never for a fault that was seen (IG-BR-06).
 */
import { writtenResults, type LiveAnswer, type LiveCheckInput, type LiveItem, type LiveItemResult } from "./live-check";
import type { ReelMatch } from "./reel-match";

/** What a Reel's live check could not decide, for the brand to be told what it is confirming. */
export type ReelUndecided = "reel_not_fetched" | "reel_match" | "paid_partnership_label" | "written_item";

export interface ReelLiveInput {
  /** The live Reel's caption, as Instagram returned it. Untrusted text. */
  caption: string;
  /**
   * Whether the live Reel is the approved draft. "not_fetched" when Instagram gave no address for its
   * video, as it does for a Reel with licensed music: nothing could be compared.
   */
  match: ReelMatch | { match: "not_fetched" };
  items: LiveItem[];
  /** The judge, for written items that need judgment. It is given the caption as material to examine. */
  judgeWritten: LiveCheckInput["judgeWritten"];
}

export interface ReelLiveResult {
  answer: LiveAnswer;
  items: LiveItemResult[];
  /** Why the Reel cannot be fixed, when it cannot. */
  notFixable?: "not_the_approved_file";
  undecided: ReelUndecided[];
}

const ORDER: ReelUndecided[] = ["reel_not_fetched", "reel_match", "paid_partnership_label", "written_item"];

export async function reelLiveCheck(input: ReelLiveInput): Promise<ReelLiveResult> {
  const { items, match } = input;
  const results = new Map<string, LiveItemResult>();
  const undecided = new Set<ReelUndecided>();

  if (match.match === "not_fetched") undecided.add("reel_not_fetched");
  if (match.match === "unknown") undecided.add("reel_match");

  for (const item of items) {
    // The Reel was found among the creator's own media and read with their own access, or there is no check at all (IG-FR-27).
    if (item.kind === "publication") {
      results.set(item.id, { id: item.id, result: "passed", checkedBy: "platform_record", evidence: { label: "Instagram", text: "On your own account." } });
    }
    // The paid-partnership label is not in Instagram's API. It is never guessed: the brand looks.
    if (item.kind === "disclosure") {
      undecided.add("paid_partnership_label");
      results.set(item.id, { id: item.id, result: "unsure", checkedBy: "published_post" });
    }
  }

  const written = await writtenResults(items, { text: input.caption, called: "caption" }, input.judgeWritten);
  for (const [id, result] of written.results) results.set(id, result);
  if (written.unsure) undecided.add("written_item");

  const list = items.map((item) => results.get(item.id) ?? { id: item.id, result: "unsure" as const, checkedBy: "published_post" as const });
  const notFixable = match.match === "different" ? ("not_the_approved_file" as const) : undefined;
  // The worst finding wins: what cannot be fixed, then what can, then what could not be decided (IG-FR-24).
  const answer: LiveAnswer = notFixable ? "failed_not_fixable" : list.some((item) => item.result === "fix_needed") ? "failed_fixable" : undecided.size > 0 ? "cannot_decide" : "passed";

  return { answer, items: list, ...(notFixable ? { notFixable } : {}), undecided: ORDER.filter((what) => undecided.has(what)) };
}
