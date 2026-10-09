/**
 * Turns a brief into checklist items and questions (deal set-up spec DS-FR-17 to DS-FR-22).
 *
 * The model proposes; this code decides what its answer is allowed to become. The answer is checked
 * against a strict schema (DS-BR-05), every item must cite a line that is really in the brief (DS-BR-06),
 * and how an item is checked is worked out here, never taken from the model (DS-BR-07). The brief is
 * untrusted text: whatever it says, only items and questions can come out (DS-BR-04).
 */
import { z } from "zod";
import type { Platform } from "../deals/deals";

export interface BriefLine {
  number: number;
  text: string;
}

export const ITEM_KINDS = ["said", "shown_as_text", "shown", "timing", "written", "disclosure", "publication"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/** How an item will be checked, in the three ways the pages show. */
export type CheckedBy = "exact_match" | "ai_timestamp" | "at_live_check";

/** Which posts a line applies to: every post, or only the posts of one kind. */
export type AppliesTo = "all" | Platform;

/** An item the model proposed, before it is tied to a post. A question's suggested answer carries one. */
export interface ProposedItem {
  name: string;
  kind: ItemKind;
  appliesTo: AppliesTo;
  /** A code, link or hashtag that must appear exactly. */
  exact?: string;
}

export interface ReadItem {
  deliverableId: string;
  name: string;
  kind: ItemKind;
  briefLine: number;
  exact?: string;
  checkedBy: CheckedBy;
}

export interface ReadQuestion {
  briefLine: number;
  text: string;
  suggestions: { text: string; item: ProposedItem }[];
}

/** What the model answered, or why it gave no answer. */
export type ModelReply =
  | { ok: true; answer: unknown }
  /** refused: the model declined. cut_off: its answer ran out of room. unavailable: it could not be reached. */
  | { ok: false; reason: "refused" | "cut_off" | "unavailable" };

/** The model, as the reader sees it. It is given numbered lines and the kinds of post, and has no tools. */
export interface BriefModel {
  read(input: { lines: BriefLine[]; platforms: Platform[] }): Promise<ModelReply>;
}

export type BriefRead =
  | { ok: true; items: ReadItem[]; questions: ReadQuestion[] }
  | { ok: false; reason: "refused" | "cut_off" | "unavailable" | "bad_shape" };

/** The longest line the pages show. A longer one is broken between words. */
const LINE_LIMIT = 2000;
/** The longest wording the pages accept. Longer wording is cut to fit. */
const NAME_LIMIT = 200;
const QUESTION_LIMIT = 300;
const SUGGESTION_LIMIT = 120;
const SUGGESTIONS_AT_MOST = 3;

const Proposed = z.strictObject({
  name: z.string().trim().min(1),
  kind: z.enum(ITEM_KINDS),
  appliesTo: z.enum(["all", "youtube_video", "youtube_short"]),
  // Null, missing and empty all mean "no exact value".
  exact: z.string().trim().nullish(),
});

/**
 * The only shape the model's answer may have. It is also what the model is told to produce. An unknown
 * field anywhere makes the whole answer a bad shape, so the model cannot smuggle in anything else.
 */
export const ModelAnswerSchema = z.strictObject({
  items: z.array(Proposed.extend({ line: z.number().int() })),
  questions: z.array(
    z.strictObject({
      line: z.number().int(),
      question: z.string().trim().min(1),
      suggestions: z.array(z.strictObject({ answer: z.string().trim().min(1), item: Proposed })),
    }),
  ),
});

/** Splits a brief into numbered lines (DS-FR-17). Blank lines get no number. */
export function numberLines(text: string): BriefLine[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let rest = raw.trim();
    while (rest.length > LINE_LIMIT) {
      const space = rest.lastIndexOf(" ", LINE_LIMIT);
      const cut = space > 0 ? space : LINE_LIMIT;
      lines.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) lines.push(rest);
  }
  return lines.map((line, index) => ({ number: index + 1, text: line }));
}

/** How an item is checked, from its kind and whether it carries an exact value (DS-FR-20). */
export function checkedBy(kind: ItemKind, exact: string | undefined): CheckedBy {
  // What is written on the post, its disclosure and its publication can only be seen once it is live.
  if (kind === "written" || kind === "disclosure" || kind === "publication") return "at_live_check";
  return exact ? "exact_match" : "ai_timestamp";
}

const proposed = (item: z.infer<typeof Proposed>): ProposedItem => ({
  name: item.name.slice(0, NAME_LIMIT),
  kind: item.kind,
  appliesTo: item.appliesTo,
  ...(item.exact ? { exact: item.exact } : {}),
});

export async function readBrief(input: {
  model: BriefModel;
  lines: BriefLine[];
  posts: { id: string; platform: Platform }[];
}): Promise<BriefRead> {
  const { model, lines, posts } = input;
  const platforms = [...new Set(posts.map((post) => post.platform))];
  const inBrief = new Set(lines.map((line) => line.number));

  // A bad shape is asked for once more. A second one fails the read, and nothing from either is kept.
  for (let ask = 0; ask < 2; ask++) {
    const reply = await model.read({ lines, platforms });
    if (!reply.ok) return reply;
    const parsed = ModelAnswerSchema.safeParse(reply.answer);
    if (!parsed.success) continue;

    const items: ReadItem[] = [];
    for (const raw of parsed.data.items) {
      // No item exists without a line of the brief behind it.
      if (!inBrief.has(raw.line)) continue;
      const item = proposed(raw);
      for (const post of posts) {
        if (item.appliesTo !== "all" && item.appliesTo !== post.platform) continue;
        items.push({
          deliverableId: post.id,
          name: item.name,
          kind: item.kind,
          briefLine: raw.line,
          ...(item.exact ? { exact: item.exact } : {}),
          checkedBy: checkedBy(item.kind, item.exact),
        });
      }
    }
    const questions: ReadQuestion[] = parsed.data.questions
      .filter((question) => inBrief.has(question.line))
      .map((question) => ({
        briefLine: question.line,
        text: question.question.slice(0, QUESTION_LIMIT),
        suggestions: question.suggestions
          .slice(0, SUGGESTIONS_AT_MOST)
          .map((suggestion) => ({ text: suggestion.answer.slice(0, SUGGESTION_LIMIT), item: proposed(suggestion.item) })),
      }));
    return { ok: true, items, questions };
  }
  return { ok: false, reason: "bad_shape" };
}
