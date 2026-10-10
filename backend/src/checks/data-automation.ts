/**
 * The real speech-and-text port: Amazon Bedrock Data Automation (draft check and review spec DR-FR-12).
 * It reads a stored video and writes what was said and what text was on screen, each with its times,
 * to the same bucket, beside the video, where it is deleted with the draft (DR-BR-19).
 *
 * Reading takes minutes, so it is started and asked after. The project it runs with must have the
 * transcript and text detection turned on for video; AWS's built-in project has no transcript.
 *
 * Not yet proven against the real service. The on-screen text fields are as AWS documents them. The
 * speech fields (`audio_segments`) are from memory of the same output and must be checked on a real run.
 */
import { BedrockDataAutomationRuntimeClient, GetDataAutomationStatusCommand, InvokeDataAutomationAsyncCommand } from "@aws-sdk/client-bedrock-data-automation-runtime";
import type { SpeechAndText } from "./ports";
import type { TimedText } from "./text";

const seconds = (millis: unknown) => (typeof millis === "number" && Number.isFinite(millis) ? millis / 1000 : undefined);
const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((each): each is Record<string, unknown> => typeof each === "object" && each !== null) : []);

/** Where Data Automation wrote its result, from the note it leaves when it finishes. */
export function standardOutputPath(jobMetadata: unknown): string | undefined {
  // The note nests the path under the asset and its segment. It is looked for wherever it sits.
  const stack: unknown[] = [jobMetadata];
  while (stack.length) {
    const next = stack.pop();
    if (Array.isArray(next)) stack.push(...next);
    else if (typeof next === "object" && next !== null) {
      for (const [key, value] of Object.entries(next)) {
        if (key === "standard_output_path" && typeof value === "string") return value;
        stack.push(value);
      }
    }
  }
  return undefined;
}

/** How long a piece of on-screen text is taken to stay up when it is seen in one sampled frame only. */
const ONE_FRAME_SEC = 1;

/**
 * Timed speech and timed on-screen text, from Data Automation's result for a video. Speech comes as
 * segments with a start and an end. On-screen text comes word by word for sampled frames: the words of
 * one line are joined, and a line seen in frames that follow each other becomes one stretch of time.
 */
export function materialFrom(result: unknown): { speech: TimedText[]; screen: TimedText[] } {
  const chapters = list((result as { chapters?: unknown } | null)?.chapters);

  const speech: TimedText[] = [];
  const heard = new Set<string>();
  for (const chapter of chapters) {
    for (const segment of list(chapter.audio_segments)) {
      const startSec = seconds(segment.start_timestamp_millis);
      const endSec = seconds(segment.end_timestamp_millis);
      const text = typeof segment.text === "string" ? segment.text.trim() : "";
      const id = typeof segment.id === "string" ? segment.id : `${startSec}:${text}`;
      if (!text || startSec === undefined || endSec === undefined || heard.has(id)) continue;
      heard.add(id);
      speech.push({ text, startSec, endSec });
    }
  }
  speech.sort((a, b) => a.startSec - b.startSec);

  // Each frame's lines of text, in the order the video runs.
  const frames = chapters
    .flatMap((chapter) => list(chapter.frames))
    .flatMap((frame) => {
      const at = seconds(frame.timestamp_millis);
      if (at === undefined) return [];
      const lines = new Map<string, string[]>();
      for (const [index, word] of list(frame.text_words).entries()) {
        if (typeof word.text !== "string" || !word.text.trim()) continue;
        const line = typeof word.line_id === "string" ? word.line_id : `word-${index}`;
        lines.set(line, [...(lines.get(line) ?? []), word.text.trim()]);
      }
      return [{ at, lines: [...lines.values()].map((words) => words.join(" ")) }];
    })
    .sort((a, b) => a.at - b.at);

  const screen: TimedText[] = [];
  const showing = new Map<string, TimedText>();
  for (const [index, frame] of frames.entries()) {
    const until = frames[index + 1]?.at ?? frame.at + ONE_FRAME_SEC;
    for (const text of frame.lines) {
      const up = showing.get(text);
      if (up) up.endSec = until;
      else {
        const shown = { text, startSec: frame.at, endSec: until };
        showing.set(text, shown);
        screen.push(shown);
      }
    }
    // A line that is not in this frame has gone. If it comes back later it is a new stretch.
    for (const text of [...showing.keys()]) if (!frame.lines.includes(text)) showing.delete(text);
  }
  return { speech, screen };
}

const keyOf = (bucket: string, uri: string) => {
  const prefix = `s3://${bucket}/`;
  if (!uri.startsWith(prefix)) throw new Error("Data Automation wrote its result outside the drafts bucket");
  return uri.slice(prefix.length);
};

export function createDataAutomation(config: {
  region: string;
  bucket: string;
  /** A project with the transcript and text detection turned on for video. */
  projectArn: string;
  /** The account's Data Automation profile for the region. */
  profileArn: string;
  /** Reads a small object from the drafts bucket whole. */
  read: (key: string) => Promise<Uint8Array>;
  client?: Pick<BedrockDataAutomationRuntimeClient, "send">;
}): SpeechAndText {
  const client = config.client ?? new BedrockDataAutomationRuntimeClient({ region: config.region });
  const json = async (uri: string) => JSON.parse(new TextDecoder().decode(await config.read(keyOf(config.bucket, uri)))) as unknown;

  return {
    async start(videoKey) {
      const started = await client.send(
        new InvokeDataAutomationAsyncCommand({
          inputConfiguration: { s3Uri: `s3://${config.bucket}/${videoKey}` },
          // Beside the video, under its own key, so deleting the draft deletes what was read from it.
          outputConfiguration: { s3Uri: `s3://${config.bucket}/${videoKey}.reading/` },
          dataAutomationConfiguration: { dataAutomationProjectArn: config.projectArn, stage: "LIVE" },
          dataAutomationProfileArn: config.profileArn,
        }),
      );
      if (!started.invocationArn) throw new Error("Data Automation did not say what it started");
      return { jobId: started.invocationArn };
    },

    async result(jobId) {
      const status = await client.send(new GetDataAutomationStatusCommand({ invocationArn: jobId }));
      if (status.status === "Created" || status.status === "InProgress") return { state: "working" };
      if (status.status !== "Success" || !status.outputConfiguration?.s3Uri) return { state: "failed" };
      const path = standardOutputPath(await json(status.outputConfiguration.s3Uri));
      if (!path) return { state: "failed" };
      return { state: "done", ...materialFrom(await json(path)) };
    },
  };
}
