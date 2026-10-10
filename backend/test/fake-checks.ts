/**
 * Stand-ins for the three services a draft check asks. Left alone they describe one good video: the
 * code is said and shown, and the serum is used on camera. A test changes what they answer, or takes
 * one down, and reads back what each was asked.
 */
import type { Judge, ModelReply, SpeechAndText, VideoModel } from "../src/checks/ports";
import type { TimedText } from "../src/checks/text";

const UNAVAILABLE: ModelReply = { ok: false, reason: "unavailable" };

export class FakeSpeech implements SpeechAndText {
  speech: TimedText[] = [
    { text: "Hey everyone, welcome back to the channel.", startSec: 0, endSec: 4 },
    { text: "Today's video is sponsored by Glow Serum.", startSec: 12, endSec: 16 },
    { text: "Use code GLOW20 for twenty percent off.", startSec: 40, endSec: 44 },
  ];
  screen: TimedText[] = [{ text: "GLOW20", startSec: 40, endSec: 46 }];
  /** How many times it says it is still working before it is done. */
  stillWorking = 0;
  /** "start" and "result" make that call throw. "reading" makes the reading itself end in failure. */
  down?: "start" | "result" | "reading";
  /** Every video it was asked to read. */
  readonly started: string[] = [];

  async start(videoKey: string) {
    if (this.down === "start") throw new Error("Data Automation is throttling");
    this.started.push(videoKey);
    return { jobId: `reading-${this.started.length}` };
  }

  async result(_jobId: string) {
    if (this.down === "result") throw new Error("Data Automation timed out");
    if (this.down === "reading") return { state: "failed" as const };
    if (this.stillWorking > 0) {
      this.stillWorking--;
      return { state: "working" as const };
    }
    return { state: "done" as const, speech: this.speech, screen: this.screen };
  }
}

export class FakeJudge implements Judge {
  down = false;
  /** What it answers about said and shown-as-text items. Left alone, nothing: every such item is unsure. */
  text: (input: Parameters<Judge["judgeText"]>[0]) => ModelReply = () => ({ ok: true, answer: { items: [] } });
  moments: (input: Parameters<Judge["findMoments"]>[0]) => ModelReply = () => ({ ok: true, answer: { items: [] } });
  /** What the second look sees in the frames. */
  visible: "yes" | "no" | "cannot_tell" = "yes";
  readonly asked = { text: 0, moments: 0, frames: 0 };

  async judgeText(input: Parameters<Judge["judgeText"]>[0]) {
    this.asked.text++;
    return this.down ? UNAVAILABLE : this.text(input);
  }

  async findMoments(input: Parameters<Judge["findMoments"]>[0]) {
    this.asked.moments++;
    return this.down ? UNAVAILABLE : this.moments(input);
  }

  async lookAtFrames(_input: Parameters<Judge["lookAtFrames"]>[0]): Promise<ModelReply> {
    this.asked.frames++;
    return this.down ? UNAVAILABLE : { ok: true, answer: { visible: this.visible } };
  }
}

export class FakeVideoModel implements VideoModel {
  down = false;
  /** What it finds for every shown item it is asked about. */
  verdict: "passed" | "fix_needed" | "unsure" = "passed";
  /** Every request it got. */
  readonly asked: Parameters<VideoModel["judgeShown"]>[0][] = [];
  /** Called as it is asked, so a test can look at the post while the check is part-way through. */
  whenAsked?: () => Promise<void>;

  async judgeShown(input: Parameters<VideoModel["judgeShown"]>[0]): Promise<ModelReply> {
    this.asked.push(input);
    await this.whenAsked?.();
    if (this.down) return UNAVAILABLE;
    return {
      ok: true,
      answer: {
        items: input.items.map((item) =>
          this.verdict === "passed"
            ? { id: item.id, verdict: "passed", startSec: 16, endSec: 20, description: "She applies the serum to her cheek." }
            : { id: item.id, verdict: this.verdict, reason: "The bottle is on the desk but is never used." },
        ),
      },
    };
  }
}
