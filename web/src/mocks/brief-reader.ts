import type { z } from "zod";
import type { dealDraftSchema } from "@/lib/api/schemas";

type Draft = z.infer<typeof dealDraftSchema>;
type Item = Draft["items"][number];
type Question = Draft["questions"][number];
type Kind = Item["kind"];
type Platform = Draft["deliverables"][number]["platform"];

/*
 * A rule-based stand-in for the AI that reads a brief (BC-FR-07, BC-FR-11,
 * BC-FR-13). Mock only: the real reading is Claude on Bedrock, on the backend.
 * It is deterministic, so any pasted brief gives a believable checklist.
 */

const LIVE: Kind[] = ["written", "disclosure", "publication"];
export const checkedByFor = (kind: Kind, exact = false): Item["checkedBy"] =>
  LIVE.includes(kind) ? "at_live_check" : exact ? "exact_match" : "ai_timestamp";

/** Which deliverables a line is about: the ones it names, else all of them. */
function targets(text: string, deliverables: Draft["deliverables"]): string[] {
  const t = text.toLowerCase();
  const named: Platform[] = [];
  if (/\byoutube\b|\bvideo\b(?!s)/.test(t) && !/\bshorts?\b/.test(t)) named.push("youtube_video");
  if (/\bshorts?\b/.test(t)) named.push("youtube_short");
  if (/\breels?\b|\binstagram\b/.test(t)) named.push("instagram_reel");
  const hit = deliverables.filter((d) => named.includes(d.platform)).map((d) => d.id);
  return hit.length ? hit : deliverables.map((d) => d.id);
}

const codeIn = (t: string) => t.match(/\bcode\s+([A-Z0-9]{3,})/)?.[1];
const linkIn = (t: string) => t.match(/\b[\w-]+\.(?:com|co|io|shop|store)(?:\/[\w-]+)*/)?.[0];
const tagIn = (t: string) => t.match(/#\w+/)?.[0];

/** Items (by kind, name and exactness) a line asks for, or a question when it is vague. */
type Read = { kind: Kind; name: string; exact: boolean; on?: Platform[] };

function readLine(text: string, brand: string): { items: Read[]; question?: Omit<Question, "id" | "briefLine"> } {
  const t = text.toLowerCase();
  if (/\b(fun|authentic|vibe|tone|energy|natural|genuine)\b/.test(t) && !/\b(say|show|mention|put)\b/.test(t)) {
    return { items: [], question: { text: `“${text.replace(/[.!]+$/, "")}” can’t be checked in a video. Leave it out?`, suggestions: [] } };
  }
  if (/\b(early|soon|quickly|up front|upfront)\b/.test(t) && !/\b\d+\s*(seconds?|s)\b/.test(t)) {
    return {
      items: [],
      question: {
        text: `“${text.replace(/[.!]+$/, "")}”: how early?`,
        suggestions: ["In the first 10 seconds", "In the first 30 seconds"],
      },
    };
  }
  const items: Read[] = [];
  const code = codeIn(text);
  if (code && /\bsay\b/.test(t)) items.push({ kind: "said", name: `Says the code ${code}`, exact: true });
  if (code && /\bshow\b/.test(t)) items.push({ kind: "shown_as_text", name: `Shows the code ${code} on screen`, exact: true });
  const link = linkIn(text);
  const tag = tagIn(text);
  // A YouTube post has a description, a Reel a caption: each written item goes where it can live.
  if (link && /description|caption|bio/.test(t)) {
    const inCaption = /caption/.test(t) && !/description/.test(t);
    items.push({ kind: "written", name: `${link} in the ${inCaption ? "caption" : "description"}`, exact: true, on: inCaption ? ["instagram_reel"] : ["youtube_video", "youtube_short"] });
  }
  if (tag && /caption|description/.test(t)) {
    const inDescription = /description/.test(t) && !/caption/.test(t);
    items.push({ kind: "written", name: `${tag} in the ${inDescription ? "description" : "caption"}`, exact: true, on: inDescription ? ["youtube_video", "youtube_short"] : ["instagram_reel"] });
  }
  if (/paid promotion|paid partnership|#ad\b|sponsored label|disclos/.test(t)) items.push({ kind: "disclosure", name: "Marked as a paid promotion", exact: false });
  if (!code && /\b(first|within)\s+\d+\s*(seconds?|s)\b/.test(t)) {
    const when = t.match(/\b(?:first|within)\s+\d+\s*(?:seconds?|s)\b/)?.[0];
    items.push({ kind: "timing", name: `Says “${brand}” in the ${when?.replace(/^within/, "first")}`, exact: false });
  } else if (!code && /\b(logo)\b/.test(t)) {
    const secs = t.match(/\b(\d+)\s*(?:seconds?|s)\b/)?.[1];
    items.push({ kind: "shown", name: `Logo on screen${secs ? ` for ${secs}+ seconds` : ""}`, exact: false });
  } else if (!code && /\bshow\b/.test(t) && !link && !tag) {
    items.push({ kind: "shown", name: `Shows ${text.replace(/^show\s+/i, "").replace(/[.!]+$/, "").replace(/^our\s+/i, "the ")}`, exact: false });
  } else if (!code && /\b(say|mention)\b/.test(t) && !link && !tag) {
    items.push({ kind: "said", name: `Says ${text.replace(/^.*?\b(say|mention)\b\s*/i, "").replace(/[.!]+$/, "")}`, exact: false });
  }
  return { items };
}

let seq = 0;
const nextId = (p: string) => `${p}_${(++seq).toString(36)}`;

/** Reads the whole brief into items and questions, in line order. */
export function readBrief(lines: { number: number; text: string }[], deliverables: Draft["deliverables"], brand: string) {
  const items: Item[] = [];
  const questions: Question[] = [];
  for (const line of lines) {
    const read = readLine(line.text, brand);
    if (read.question) {
      questions.push({ id: nextId("q"), briefLine: line.number, ...read.question });
      continue;
    }
    for (const it of read.items) {
      const lineTargets = targets(line.text, deliverables);
      const onPost = it.on ? deliverables.filter((d) => it.on!.includes(d.platform) && lineTargets.includes(d.id)).map((d) => d.id) : [];
      for (const deliverableId of it.on ? (onPost.length ? onPost : lineTargets) : lineTargets) {
        items.push({ id: nextId("it"), deliverableId, name: it.name, kind: it.kind, briefLine: line.number, addedByCreator: false, checkedBy: checkedByFor(it.kind, it.exact) });
      }
    }
  }
  // Items for the same line keep together, each kind across the deliverables in order.
  items.sort((a, b) => a.briefLine! - b.briefLine! || kindOrder(a.kind) - kindOrder(b.kind));
  return { items, questions, targetsFor: (n: number) => targets(lines.find((l) => l.number === n)?.text ?? "", deliverables), nextId };
}

const ORDER: Kind[] = ["timing", "said", "shown_as_text", "shown", "written", "disclosure", "publication"];
const kindOrder = (k: Kind) => ORDER.indexOf(k);
export { nextId };
