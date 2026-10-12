/**
 * What was said in a draft, kept beside its file (Instagram Reels spec IG-FR-21, "The approved
 * draft's reading is not made again"). The draft check reads a video once; when a live Reel is later
 * matched to the approved draft, the draft's words are read from here and not asked of AWS again.
 *
 * It is kept under the draft's own key, so it is deleted with the draft (DR-BR-19). It is what a video
 * said: untrusted material, compared and never obeyed, and never logged (DR-BR-09, DR-BR-18).
 */
import { z } from "zod";
import type { TimedText } from "../checks/text";
import type { Storage } from "../storage/port";

/** A draft's reading is small: fifteen minutes of speech is a few tens of thousands of characters. */
const MAX_BYTES = 2 * 1024 * 1024;

const Kept = z.array(z.object({ text: z.string(), startSec: z.number(), endSec: z.number() }));

/** Where a draft's speech is kept: beside the draft's file, under its key. */
export const heardKey = (storageKey: string) => `${storageKey}.heard.json`;

/** Keeps what was said in a draft. Kept again, it replaces what was there. */
export async function keepHeard(storage: Pick<Storage, "put">, storageKey: string, speech: TimedText[]): Promise<void> {
  const body = new TextEncoder().encode(JSON.stringify(speech.map(({ text, startSec, endSec }) => ({ text, startSec, endSec }))));
  const stored = await storage.put(heardKey(storageKey), new Blob([body]).stream(), { maxBytes: MAX_BYTES });
  if (stored === "too_large") throw new Error("What was said in a draft is too long to keep");
}

/** What was said in a draft, as it was kept. Nothing if none was kept, or if what is there is not what was kept. */
export async function heardIn(storage: Pick<Storage, "read">, storageKey: string): Promise<TimedText[] | undefined> {
  const stored = await storage.read(heardKey(storageKey));
  if (!stored) return undefined;
  try {
    const kept = Kept.safeParse(JSON.parse(new TextDecoder().decode(stored)));
    return kept.success ? kept.data : undefined;
  } catch {
    return undefined;
  }
}
