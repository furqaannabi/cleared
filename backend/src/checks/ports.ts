/**
 * The services a draft check asks (draft check and review spec DR-FR-12, DR-FR-15 to DR-FR-19). Each
 * is a port: the real ones call Amazon Bedrock, tests use stand-ins. None of them has tools, and none
 * decides anything: they return findings, which fixed code then checks (DR-BR-01, DR-BR-10).
 */
import type { TimedText } from "./text";

/** What a model answered, or why it gave no answer. The answer is unchecked: its shape is verified by the caller. */
export type ModelReply =
  | { ok: true; answer: unknown }
  /** refused: the model declined. cut_off: its answer ran out of room. unavailable: it could not be reached. */
  | { ok: false; reason: "refused" | "cut_off" | "unavailable" };

/** What was said in a video and what text was on screen, each with its times (DR-FR-12). */
export interface SpeechAndText {
  /** Starts reading a stored video. The reading takes minutes, so the answer is asked for later. */
  start(videoKey: string): Promise<{ jobId: string }>;
  result(jobId: string): Promise<{ state: "working" } | { state: "failed" } | { state: "done"; speech: TimedText[]; screen: TimedText[] }>;
}

/** An item as a model is shown it: its id to answer by, and its wording. */
export interface AskedItem {
  id: string;
  name: string;
}

/** Claude, as the check uses it. Speech and on-screen text are given as material to examine, never as instructions (DR-BR-09). */
export interface Judge {
  /** Judges said and shown-as-text items against the timed speech and on-screen text (DR-FR-15, DR-FR-16). */
  judgeText(input: { said: AskedItem[]; shownAsText: AskedItem[]; speech: TimedText[]; screen: TimedText[] }): Promise<ModelReply>;
  /** Finds the moment or segment each timing item means. It returns no result for them (DR-FR-17). */
  findMoments(input: { items: AskedItem[]; speech: TimedText[]; screen: TimedText[] }): Promise<ModelReply>;
  /** The second look: is this visible in these frames. It is not told what the video model answered (DR-FR-19). */
  lookAtFrames(input: { item: AskedItem; frames: Uint8Array[] }): Promise<ModelReply>;
}

/** Amazon Nova, as the check uses it: it watches the stored video and judges the shown items (DR-FR-18). */
export interface VideoModel {
  judgeShown(input: { videoKey: string; format: "mp4" | "mov"; durationSec: number; items: AskedItem[] }): Promise<ModelReply>;
}
