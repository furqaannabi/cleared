/**
 * Checks one draft against its checklist (draft check and review spec DR-FR-11 to DR-FR-24). Models
 * propose and this code decides: exact items are matched by code, every model answer is checked
 * against a strict schema, and a pass counts only once its evidence is verified (DR-BR-04 to DR-BR-08).
 * It stores nothing and moves nothing. If a service cannot be reached it throws, so a run is never
 * shown in part (DR-FR-23).
 */
import { z } from "zod";
import type { Checked } from "../review/rules";
import { findExact } from "./exact";
import type { AskedItem, Judge, ModelReply, VideoModel } from "./ports";
import type { TimedText } from "./text";
import { frameTimes, verifyQuote, verifyShown, verifyTiming, type SecondLook, type Span } from "./verify";

/** A checklist item as the check needs it. */
export interface CheckItem {
  id: string;
  name: string;
  kind: "said" | "shown_as_text" | "shown" | "timing" | "written" | "disclosure" | "publication";
  /** A code, link or hashtag that must appear exactly. */
  exact?: string;
}

/** How an item was checked, in the words the creator's page shows. */
export type CheckedBy = "exact_match" | "ai_timestamp" | "from_timestamps" | "published_post" | "platform_record";

export interface ItemResult {
  id: string;
  result: Checked;
  checkedBy: CheckedBy;
  /** What the result rests on: where it came from, the words or description, and when in the video. */
  evidence?: { label: string; text: string; startSec: number; endSec: number };
  /** One plain sentence saying what to change. Guidance only: it never affects a result (DR-FR-24). */
  hint?: string;
}

/** How an item is checked, from its kind and whether it carries an exact value. Decided by code, never by a model. */
export function howChecked(item: Pick<CheckItem, "kind" | "exact">): CheckedBy {
  if (item.kind === "written" || item.kind === "disclosure") return "published_post";
  if (item.kind === "publication") return "platform_record";
  if (item.kind === "timing") return "from_timestamps";
  return item.exact && item.kind !== "shown" ? "exact_match" : "ai_timestamp";
}

export type Stage = "said" | "shown" | "confirming";

export interface CheckInput {
  items: CheckItem[];
  speech: TimedText[];
  screen: TimedText[];
  video: { key: string; format: "mp4" | "mov"; durationSec: number };
  judge: Judge;
  videoModel: VideoModel;
  /** Cuts still frames from the video at these moments, for the second look. */
  frames: (timesSec: number[]) => Promise<Uint8Array[]>;
  onStage?: (stage: Stage) => Promise<void>;
}

/** A service the check needs could not be reached. The whole run fails and is tried again (DR-FR-23). */
export class ServiceFailed extends Error {
  constructor(what: string) {
    super(`The draft check could not reach ${what}`);
    this.name = "ServiceFailed";
  }
}

const HINT_MAX = 280;

/** A suggestion as one line of plain text, or nothing if there is none or it is too long (DR-FR-24). */
export function plainHint(text: string | undefined): string | undefined {
  const line = (text ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/ {2,}/g, " ").trim();
  return line && line.length <= HINT_MAX ? line : undefined;
}

const withHint = (hint: string | undefined) => (hint ? { hint } : {});

const Verdict = z.enum(["passed", "fix_needed", "unsure"]);
const Seconds = z.number().finite();
/** Every answer about items is a list. Each entry is checked on its own, so one bad entry spoils only its item. */
const Envelope = z.object({ items: z.array(z.unknown()) }).strict();
const WithId = z.object({ id: z.string() });

const TextAnswer = z
  .object({ id: z.string(), verdict: Verdict, quote: z.string().max(2000).optional(), startSec: Seconds.optional(), endSec: Seconds.optional(), reason: z.string().optional() })
  .strict();

/** A timing answer has no verdict: the model may say where, never whether (DR-FR-17). */
const MomentAnswer = z
  .object({
    id: z.string(),
    found: z.boolean(),
    limit: z.object({ kind: z.enum(["by", "at_least"]), seconds: Seconds }).strict().optional(),
    startSec: Seconds.optional(),
    endSec: Seconds.optional(),
    startQuote: z.string().max(2000).optional(),
    endQuote: z.string().max(2000).optional(),
    reason: z.string().optional(),
  })
  .strict();

const ShownAnswer = z
  .object({ id: z.string(), verdict: Verdict, startSec: Seconds.optional(), endSec: Seconds.optional(), description: z.string().max(500).optional(), reason: z.string().optional() })
  .strict();

const FramesAnswer = z.object({ visible: z.enum(["yes", "no", "cannot_tell"]) }).strict();

/** Asks a service, and turns one that cannot be reached, or that throws, into a failed run. */
async function reach(what: string, ask: () => Promise<ModelReply>): Promise<Exclude<ModelReply, { reason: "unavailable" }>> {
  let reply: ModelReply;
  try {
    reply = await ask();
  } catch {
    throw new ServiceFailed(what);
  }
  if (!reply.ok && reply.reason === "unavailable") throw new ServiceFailed(what);
  return reply as Exclude<ModelReply, { reason: "unavailable" }>;
}

/**
 * A model's answers about items, each checked against `shape`, by item id. An answer in the wrong
 * shape as a whole is asked for once more; a second one, a refusal or an answer cut off gives no
 * entries at all, so every item asked about is unsure. Entries about items that were not asked about
 * are ignored, a repeated entry does not replace the first, and a malformed entry is dropped (DR-BR-08).
 */
export async function answersFor<Shape extends z.ZodType<{ id: string }>>(what: string, asked: AskedItem[], shape: Shape, ask: () => Promise<ModelReply>) {
  const byId = new Map<string, z.infer<Shape>>();
  if (asked.length === 0) return byId;
  const ids = new Set(asked.map((item) => item.id));

  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await reach(what, ask);
    if (!reply.ok) return byId;
    const envelope = Envelope.safeParse(reply.answer);
    if (!envelope.success) continue;

    const spoiled = new Set<string>();
    for (const entry of envelope.data.items) {
      const id = WithId.safeParse(entry);
      if (!id.success || !ids.has(id.data.id) || byId.has(id.data.id) || spoiled.has(id.data.id)) continue;
      const parsed = shape.safeParse(entry);
      // A malformed entry settles its item as unsure: a later, tidier entry for it is not trusted either.
      if (parsed.success) byId.set(id.data.id, parsed.data);
      else spoiled.add(id.data.id);
    }
    return byId;
  }
  return byId;
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export async function checkDraft(input: CheckInput): Promise<ItemResult[]> {
  const { items, speech, screen, video, judge, videoModel } = input;
  const results = new Map<string, ItemResult>();
  const stage = async (name: Stage) => void (await input.onStage?.(name));
  const asked = (list: CheckItem[]): AskedItem[] => list.map(({ id, name }) => ({ id, name }));

  const text = items.filter((item) => item.kind === "said" || item.kind === "shown_as_text");
  const exact = text.filter((item) => item.exact);
  const judged = text.filter((item) => !item.exact);
  const timing = items.filter((item) => item.kind === "timing");
  const shown = items.filter((item) => item.kind === "shown");

  // Checked only on the published post: labelled, and left alone (DR-FR-11).
  for (const item of items) {
    if (item.kind === "written" || item.kind === "disclosure") results.set(item.id, { id: item.id, result: "at_live_check", checkedBy: "published_post" });
    if (item.kind === "publication") results.set(item.id, { id: item.id, result: "at_live_check", checkedBy: "platform_record" });
  }

  await stage("said");

  // Exact items: code alone, no model (DR-BR-04).
  for (const item of exact) {
    const said = item.kind === "said";
    const label = said ? "Transcript" : "On-screen text";
    const found = findExact(item.exact!, said ? speech : screen, said ? "speech" : "screen");
    const base = { id: item.id, checkedBy: "exact_match" as const };
    if (found.found === "match") {
      results.set(item.id, { ...base, result: "passed", evidence: { label, text: found.text, startSec: found.startSec, endSec: found.endSec } });
    } else if (found.found === "near") {
      const hint = said
        ? `We heard "${found.text}", not "${item.exact}". If that is right, ask the brand to accept it. If not, say "${item.exact}" clearly.`
        : `We saw "${found.text}" on screen, not "${item.exact}". If that is right, ask the brand to accept it. If not, show "${item.exact}" clearly.`;
      results.set(item.id, { ...base, result: "unsure", evidence: { label, text: found.text, startSec: found.startSec, endSec: found.endSec }, ...withHint(plainHint(hint)) });
    } else {
      const hint = said ? `Say "${item.exact}" out loud, exactly as written.` : `Show "${item.exact}" on screen as text, exactly as written.`;
      results.set(item.id, { ...base, result: "fix_needed", ...withHint(plainHint(hint)) });
    }
  }

  // Said and shown-as-text items that need judgment: the model's pass counts only if its quote is really there (DR-BR-05).
  const textAnswers = await answersFor("the judge", asked(judged), TextAnswer, () =>
    judge.judgeText({
      said: asked(judged.filter((item) => item.kind === "said")),
      shownAsText: asked(judged.filter((item) => item.kind === "shown_as_text")),
      speech,
      screen,
    }),
  );
  for (const item of judged) {
    const answer = textAnswers.get(item.id);
    const base = { id: item.id, checkedBy: "ai_timestamp" as const };
    if (!answer) {
      results.set(item.id, { ...base, result: "unsure" });
    } else if (answer.verdict !== "passed") {
      results.set(item.id, { ...base, result: answer.verdict, ...withHint(plainHint(answer.reason)) });
    } else {
      const said = item.kind === "said";
      const found =
        answer.quote !== undefined && answer.startSec !== undefined && answer.endSec !== undefined
          ? verifyQuote({ quote: answer.quote, startSec: answer.startSec, endSec: answer.endSec }, said ? speech : screen, said ? "speech" : "screen", video.durationSec)
          : undefined;
      results.set(item.id, found ? { ...base, result: "passed", evidence: { label: said ? "Transcript" : "On-screen text", ...found } } : { ...base, result: "unsure" });
    }
  }

  // Timing items: the model finds the moments, code does the sum (DR-BR-06).
  const moments = await answersFor("the judge", asked(timing), MomentAnswer, () => judge.findMoments({ items: asked(timing), speech, screen }));
  for (const item of timing) {
    const answer = moments.get(item.id);
    const base = { id: item.id, checkedBy: "from_timestamps" as const };
    if (!answer || !answer.found) {
      results.set(item.id, { ...base, result: "unsure", ...withHint(plainHint(answer?.reason)) });
      continue;
    }
    const { limit, startSec, endSec, startQuote, endQuote } = answer;
    const decided =
      limit && startSec !== undefined && endSec !== undefined && startQuote !== undefined
        ? verifyTiming({ limit, startSec, endSec, startQuote, endQuote }, item.name, { speech, screen }, video.durationSec)
        : ({ status: "unsure" } as const);
    if (decided.status === "unsure") {
      results.set(item.id, { ...base, result: "unsure" });
    } else {
      const evidence = { label: "Timestamps", ...decided.evidence };
      const hint =
        decided.status === "passed"
          ? undefined
          : limit!.kind === "by"
            ? `This starts at ${clock(evidence.startSec)}. It needs to start within the first ${limit!.seconds} seconds.`
            : `This runs for ${Math.round(evidence.endSec - evidence.startSec)} seconds. It needs to run for at least ${limit!.seconds}.`;
      results.set(item.id, { ...base, result: decided.status, evidence, ...withHint(hint) });
    }
  }

  await stage("shown");

  // Shown items: the video model watches the video. Its passes wait for the second look (DR-BR-07).
  const shownAnswers = await answersFor("the video model", asked(shown), ShownAnswer, () =>
    videoModel.judgeShown({ videoKey: video.key, format: video.format, durationSec: video.durationSec, items: asked(shown) }),
  );
  const toConfirm: { item: CheckItem; span: Span; description: string }[] = [];
  for (const item of shown) {
    const answer = shownAnswers.get(item.id);
    const base = { id: item.id, checkedBy: "ai_timestamp" as const };
    if (!answer) {
      results.set(item.id, { ...base, result: "unsure" });
    } else if (answer.verdict !== "passed") {
      results.set(item.id, { ...base, result: answer.verdict, ...withHint(plainHint(answer.reason)) });
    } else if (answer.startSec === undefined || answer.endSec === undefined || !verifyShown({ startSec: answer.startSec, endSec: answer.endSec }, "yes", video.durationSec)) {
      // No moment, or one outside the video: there is nothing to look at twice.
      results.set(item.id, { ...base, result: "unsure" });
    } else {
      toConfirm.push({ item, span: { startSec: answer.startSec, endSec: Math.min(answer.endSec, video.durationSec) }, description: plainHint(answer.description) ?? "Shown in the video." });
    }
  }

  await stage("confirming");

  for (const { item, span, description } of toConfirm) {
    let frames: Uint8Array[];
    try {
      frames = await input.frames(frameTimes(span, video.durationSec));
    } catch {
      throw new ServiceFailed("the video's frames");
    }
    // The second look is told the item and shown the frames. It is never told what the video model said (DR-FR-19).
    let look: SecondLook = "cannot_tell";
    for (let attempt = 0; attempt < 2; attempt++) {
      const reply = await reach("the second look", () => judge.lookAtFrames({ item: { id: item.id, name: item.name }, frames }));
      if (!reply.ok) break;
      const parsed = FramesAnswer.safeParse(reply.answer);
      if (parsed.success) {
        look = parsed.data.visible;
        break;
      }
    }
    results.set(item.id, {
      id: item.id,
      result: verifyShown(span, look, video.durationSec) ? "passed" : "unsure",
      checkedBy: "ai_timestamp",
      evidence: { label: "Video", text: description, ...span },
    });
  }

  // One result for every item, in the checklist's order. An item nothing above settled is unsure.
  return items.map((item) => results.get(item.id) ?? { id: item.id, result: "unsure", checkedBy: "ai_timestamp" });
}
