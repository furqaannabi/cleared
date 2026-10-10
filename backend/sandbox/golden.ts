/**
 * The golden set: the real check run on each of the team's recorded clips, and every item's result
 * compared with the one written down for it (draft check and review spec DR-FR-51). Run with
 * `pnpm golden`. It needs the drafts bucket, Data Automation, Claude and Nova, and ffmpeg, and every
 * run costs money, so it is never part of `pnpm test`.
 *
 * It prints each difference, how long each clip took, and what each service used. It prints nothing
 * that was said or shown in a clip beyond the evidence for an item that differs.
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { checkDraft, type CheckItem } from "../src/checks/check";
import { createClaudeJudge } from "../src/checks/claude-judge";
import { createDataAutomation } from "../src/checks/data-automation";
import { createNovaVideoModel } from "../src/checks/nova";
import { env } from "../src/env";
import { createFfmpegMedia } from "../src/media/ffmpeg";
import { createS3Storage } from "../src/storage/s3";

interface Clip {
  clip: string;
  about?: string;
  items: CheckItem[];
  expected: Record<string, string>;
}

if (!env.drafts) throw new Error("Set DRAFTS_BUCKET and the Data Automation ARNs first. See backend/.env.example.");
const { bucket, projectArn, profileArn, videoModel } = env.drafts;
const used: Record<string, unknown>[] = [];
const log = (message: string, details: Record<string, unknown>) => void used.push({ message, ...details });

const storage = createS3Storage({ bucket, region: env.awsRegion });
const media = createFfmpegMedia();
const speech = createDataAutomation({ region: env.awsRegion, bucket, projectArn, profileArn, read: storage.read });
const judge = createClaudeJudge({ model: env.judgeModel, region: env.awsRegion, log });
const nova = createNovaVideoModel({ model: videoModel, region: env.awsRegion, bucket, log });

const folder = join(import.meta.dir, "golden");
const files = (await readdir(folder)).filter((name) => name.endsWith(".json")).sort();
if (files.length === 0) {
  console.log("No clips are listed yet. Add one JSON file per clip to backend/sandbox/golden (see its README).");
  process.exit(0);
}

let differences = 0;
for (const name of files) {
  const clip = (await Bun.file(join(folder, name)).json()) as Clip;
  const started = Date.now();
  used.length = 0;
  console.log(`\n${name}  (${clip.clip})`);

  const address = await storage.address(clip.clip, 15 * 60);
  const found = await media.probe(address);
  if (found === "unreadable" || found.format === "other") {
    console.log(`  could not be read as an MP4 or MOV`);
    differences++;
    continue;
  }

  const { jobId } = await speech.start(clip.clip);
  let read = await speech.result(jobId);
  while (read.state === "working") {
    await Bun.sleep(10_000);
    read = await speech.result(jobId);
  }
  if (read.state !== "done") {
    console.log("  Data Automation could not read it");
    differences++;
    continue;
  }

  const results = await checkDraft({
    items: clip.items,
    speech: read.speech,
    screen: read.screen,
    video: { key: clip.clip, format: found.format, durationSec: found.durationSec },
    judge,
    videoModel: nova,
    frames: (timesSec) => media.frames(address, timesSec),
  });
  // What Data Automation wrote beside the clip is not kept.
  await storage.deleteUnder(`${clip.clip}.reading/`);

  for (const result of results) {
    const expected = clip.expected[result.id];
    const same = expected === result.result;
    if (!same) differences++;
    const evidence = result.evidence ? `  [${result.evidence.startSec}-${result.evidence.endSec}] ${result.evidence.label}: "${result.evidence.text}"` : "";
    console.log(`  ${same ? "ok  " : "DIFF"} ${result.id}: ${result.result}${same ? "" : ` (expected ${expected})${evidence}`}`);
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  const tokens = used.reduce((sum, call) => sum + Number(call.inputTokens ?? 0) + Number(call.outputTokens ?? 0), 0);
  console.log(`  ${found.durationSec.toFixed(0)}s of video, checked in ${seconds}s, ${used.length} model calls, ${tokens} tokens, ${read.speech.length} pieces of speech, ${read.screen.length} of on-screen text`);
}

console.log(differences === 0 ? "\nEvery item got the result written down for it." : `\n${differences} result(s) differ from what was written down.`);
process.exit(differences === 0 ? 0 : 1);
