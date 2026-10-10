/**
 * The live check (publish to paid spec PT-FR-12, PT-FR-13): from YouTube's record of the published
 * post and the post's live-check items, to each item's result and the one answer the money path is
 * given. Pure code: it reads no YouTube and moves nothing. Fixed code decides; a model judges only
 * written items that need judgment, and its pass counts only if its quote is in the description
 * (PT-BR-02). The description is untrusted: it is searched and quoted, never obeyed (PT-BR-06).
 */
import { z } from "zod";
import { answersFor, plainHint, type CheckedBy } from "../checks/check";
import { findExact } from "../checks/exact";
import type { AskedItem, ModelReply } from "../checks/ports";
import { sameFile } from "./video";

/** YouTube's record of one video, as much of it as YouTube returned. */
export interface VideoRecord {
  videoId: string;
  privacy: "public" | "unlisted" | "private";
  channelId: string;
  description: string;
  /** Whether the video is marked as a paid promotion. Absent when YouTube did not say. */
  paidPromotion?: boolean;
  /** The uploaded file's size and length. Absent when YouTube did not say. */
  fileSizeBytes?: bigint | number;
  durationSec?: number;
  /** YouTube's own date for the video. Kept as evidence; it decides nothing (PT-FR-10). */
  publishedAt?: Date;
}

/** A checklist item that is checked on the published post. */
export interface LiveItem {
  id: string;
  name: string;
  kind: "written" | "disclosure" | "publication";
  /** A link, code or hashtag that must be in the description exactly. */
  exact?: string;
}

export interface LiveItemResult {
  id: string;
  result: "passed" | "fix_needed" | "unsure";
  checkedBy: CheckedBy;
  /** What was found on the live post. */
  evidence?: { label: string; text: string };
  /** One plain sentence saying what to change. */
  hint?: string;
}

/** The four answers the money path takes (MP-FR-17 to MP-FR-21). */
export type LiveAnswer = "passed" | "cannot_decide" | "failed_fixable" | "failed_not_fixable";

export interface LiveCheckResult {
  answer: LiveAnswer;
  items: LiveItemResult[];
  /** Why the post cannot be fixed, when it cannot. */
  notFixable?: "not_your_channel" | "not_the_approved_file";
  /** Everything Cleared could not decide, for the brand to be told what it is confirming. */
  undecided: ("file_record" | "paid_promotion" | "written_item")[];
}

export interface LiveCheckInput {
  video: VideoRecord;
  /** The creator's connected channel. */
  channelId: string;
  /** The approved draft's file. */
  draft: { sizeBytes: bigint | number; durationSec: number };
  items: LiveItem[];
  /** The judge, for written items that need judgment. It is given the description as material to examine. */
  judgeWritten: (input: { items: AskedItem[]; description: string }) => Promise<ModelReply>;
}

const WrittenAnswer = z.object({ id: z.string(), verdict: z.enum(["passed", "fix_needed", "unsure"]), quote: z.string().max(2000).optional(), reason: z.string().optional() }).strict();

const withHint = (hint: string | undefined) => (hint ? { hint } : {});

/** Where some words are in the description, as it wrote them, or nothing. Compared as codes are (DR-FR-13). */
const inDescription = (words: string, description: string) => findExact(words, [{ text: description, startSec: 0, endSec: 0 }], "screen");

export async function liveCheck(input: LiveCheckInput): Promise<LiveCheckResult> {
  const { video, items } = input;
  const results = new Map<string, LiveItemResult>();
  const undecided = new Set<LiveCheckResult["undecided"][number]>();

  const ownChannel = video.channelId === input.channelId;
  const file = sameFile(input.draft, video);
  if (file === "unknown") undecided.add("file_record");

  for (const item of items) {
    if (item.kind === "publication") {
      const base = { id: item.id, checkedBy: "platform_record" as const };
      if (!ownChannel) results.set(item.id, { ...base, result: "fix_needed", hint: "This video is not on your connected channel." });
      else if (video.privacy !== "public") results.set(item.id, { ...base, result: "fix_needed", hint: "Make the video public on YouTube." });
      else results.set(item.id, { ...base, result: "passed", evidence: { label: "YouTube", text: "Public on your channel." } });
    }

    if (item.kind === "disclosure") {
      const base = { id: item.id, checkedBy: "published_post" as const };
      if (video.paidPromotion === undefined) {
        undecided.add("paid_promotion");
        results.set(item.id, { ...base, result: "unsure" });
      } else if (video.paidPromotion) {
        results.set(item.id, { ...base, result: "passed", evidence: { label: "YouTube", text: "Marked as a paid promotion." } });
      } else {
        results.set(item.id, { ...base, result: "fix_needed", hint: 'Turn on "Includes paid promotion" for the video in YouTube Studio.' });
      }
    }

    // A link, code or hashtag: matched by code alone. A description can be edited, so anything short of a match is fixable.
    if (item.kind === "written" && item.exact) {
      const base = { id: item.id, checkedBy: "published_post" as const };
      const found = inDescription(item.exact, video.description);
      if (found.found === "match") {
        results.set(item.id, { ...base, result: "passed", evidence: { label: "Description", text: found.text } });
      } else if (found.found === "near") {
        const hint = plainHint(`The description has "${found.text}", not "${item.exact}". Change it to "${item.exact}".`);
        results.set(item.id, { ...base, result: "fix_needed", evidence: { label: "Description", text: found.text }, ...withHint(hint) });
      } else {
        results.set(item.id, { ...base, result: "fix_needed", ...withHint(plainHint(`Add "${item.exact}" to the description, exactly as written.`)) });
      }
    }
  }

  // Written items that need judgment: the judge's pass counts only if its quote is really in the description.
  const judged = items.filter((item) => item.kind === "written" && !item.exact);
  const asked = judged.map(({ id, name }) => ({ id, name }));
  const answers = await answersFor("the judge", asked, WrittenAnswer, () => input.judgeWritten({ items: asked, description: video.description }));
  for (const item of judged) {
    const answer = answers.get(item.id);
    const base = { id: item.id, checkedBy: "ai_timestamp" as const };
    const found = answer?.verdict === "passed" && answer.quote ? inDescription(answer.quote, video.description) : undefined;
    if (answer?.verdict === "fix_needed") {
      results.set(item.id, { ...base, result: "fix_needed", ...withHint(plainHint(answer.reason)) });
    } else if (found?.found === "match") {
      results.set(item.id, { ...base, result: "passed", evidence: { label: "Description", text: found.text } });
    } else {
      undecided.add("written_item");
      results.set(item.id, { ...base, result: "unsure" });
    }
  }

  const list = items.map((item) => results.get(item.id) ?? { id: item.id, result: "unsure" as const, checkedBy: "published_post" as const });
  const notFixable = !ownChannel ? ("not_your_channel" as const) : file === "different" ? ("not_the_approved_file" as const) : undefined;
  // The worst finding wins: what cannot be fixed, then what can, then what could not be decided (PT-FR-13).
  const answer: LiveAnswer = notFixable
    ? "failed_not_fixable"
    : video.privacy !== "public" || list.some((item) => item.result === "fix_needed")
      ? "failed_fixable"
      : undecided.size > 0
        ? "cannot_decide"
        : "passed";

  const order = ["file_record", "paid_promotion", "written_item"] as const;
  return { answer, items: list, ...(notFixable ? { notFixable } : {}), undecided: order.filter((what) => undecided.has(what)) };
}
