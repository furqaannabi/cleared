/**
 * Reading Data Automation's result (draft check and review spec DR-FR-12). The on-screen text below is
 * in the shape AWS documents. Against the real service the adapter is not yet proven.
 */
import { describe, expect, test } from "bun:test";
import { createDataAutomation, materialFrom, standardOutputPath } from "./data-automation";

const word = (text: string, line: string) => ({ id: `${line}-${text}`, type: "TEXT_WORD", confidence: 0.99, text, line_id: line, locations: [] });
const result = {
  metadata: { semantic_modality: "VIDEO", duration_millis: 60_000 },
  chapters: [
    {
      start_timestamp_millis: 0,
      end_timestamp_millis: 30_000,
      audio_segments: [
        { id: "a1", type: "TRANSCRIPT", text: "Today's video is sponsored by Glow Serum.", start_timestamp_millis: 12_000, end_timestamp_millis: 16_500 },
        { id: "a0", type: "TRANSCRIPT", text: " Hey everyone. ", start_timestamp_millis: 0, end_timestamp_millis: 2_000 },
      ],
      frames: [
        { timestamp_millis: 13_000, text_words: [word("GLOW", "l1"), word("SERUM", "l1"), word("20%", "l2"), word("OFF", "l2")] },
        { timestamp_millis: 14_000, text_words: [word("GLOW", "l1b"), word("SERUM", "l1b")] },
        { timestamp_millis: 15_000, text_words: [] },
      ],
    },
    {
      start_timestamp_millis: 30_000,
      end_timestamp_millis: 60_000,
      audio_segments: [
        { id: "a1", type: "TRANSCRIPT", text: "Today's video is sponsored by Glow Serum.", start_timestamp_millis: 12_000, end_timestamp_millis: 16_500 },
        { id: "a2", type: "TRANSCRIPT", text: "Use code GLOW20.", start_timestamp_millis: 40_000, end_timestamp_millis: 42_000 },
        { id: "a3", type: "TRANSCRIPT", text: "   ", start_timestamp_millis: 43_000, end_timestamp_millis: 44_000 },
      ],
      frames: [{ timestamp_millis: 40_000, text_words: [word("GLOW", "l9"), word("SERUM", "l9")] }],
    },
  ],
};

describe("DR-FR-12 what was said and what was on screen, with their times", () => {
  test("speech is each segment once, in the order it was said, in seconds", () => {
    expect(materialFrom(result).speech).toEqual([
      { text: "Hey everyone.", startSec: 0, endSec: 2 },
      { text: "Today's video is sponsored by Glow Serum.", startSec: 12, endSec: 16.5 },
      { text: "Use code GLOW20.", startSec: 40, endSec: 42 },
    ]);
  });

  test("on-screen words are joined into their lines, and a line seen in frames that follow each other is one stretch", () => {
    expect(materialFrom(result).screen).toEqual([
      { text: "GLOW SERUM", startSec: 13, endSec: 15 },
      { text: "20% OFF", startSec: 13, endSec: 14 },
      // The same words again later are a new stretch, not one that ran for half a minute.
      { text: "GLOW SERUM", startSec: 40, endSec: 41 },
    ]);
  });

  test("a result with nothing said and nothing shown, or in no shape at all, gives nothing", () => {
    expect(materialFrom({ chapters: [{ audio_segments: [], frames: [] }] })).toEqual({ speech: [], screen: [] });
    expect(materialFrom({})).toEqual({ speech: [], screen: [] });
    expect(materialFrom(null)).toEqual({ speech: [], screen: [] });
    expect(materialFrom("done")).toEqual({ speech: [], screen: [] });
  });

  test("a segment or a frame with no time is left out, never given a made-up one", () => {
    const odd = { chapters: [{ audio_segments: [{ id: "x", text: "No time" }], frames: [{ text_words: [word("LOST", "l1")] }] }] };

    expect(materialFrom(odd)).toEqual({ speech: [], screen: [] });
  });
});

describe("finding the result", () => {
  test("the path is read from the note Data Automation leaves, wherever it is nested", () => {
    const note = { job_id: "j", output_metadata: [{ asset_id: 0, segment_metadata: [{ standard_output_path: "s3://cleared-drafts/drafts/p/d.reading/j/0/standard_output/0/result.json" }] }] };

    expect(standardOutputPath(note)).toBe("s3://cleared-drafts/drafts/p/d.reading/j/0/standard_output/0/result.json");
    expect(standardOutputPath({ job_id: "j" })).toBeUndefined();
  });
});

describe("what Data Automation is asked", () => {
  /** A client that remembers what it is sent, and a bucket holding the note and the result. */
  function standIn(status: Record<string, unknown>) {
    const sent: { name: string; input: Record<string, unknown> }[] = [];
    const read: string[] = [];
    const note = { output_metadata: [{ segment_metadata: [{ standard_output_path: "s3://cleared-drafts/drafts/p/d.reading/j/result.json" }] }] };
    const reader = createDataAutomation({
      region: "us-east-1",
      bucket: "cleared-drafts",
      projectArn: "arn:aws:bedrock:us-east-1:123456789012:data-automation-project/cleared",
      profileArn: "arn:aws:bedrock:us-east-1:123456789012:data-automation-profile/us.data-automation-v1",
      read: async (key) => {
        read.push(key);
        return new TextEncoder().encode(JSON.stringify(key.endsWith("job_metadata.json") ? note : result));
      },
      client: {
        async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
          sent.push({ name: command.constructor.name, input: command.input });
          return command.constructor.name === "InvokeDataAutomationAsyncCommand" ? { invocationArn: "arn:aws:bedrock:us-east-1:123456789012:data-automation-invocation/j" } : status;
        },
      } as never,
    });
    return { reader, sent, read };
  }

  test("the stored video is read with the project's settings, and the result is written beside it", async () => {
    const { reader, sent } = standIn({});

    expect(await reader.start("drafts/p/d")).toEqual({ jobId: "arn:aws:bedrock:us-east-1:123456789012:data-automation-invocation/j" });

    expect(sent[0]!.input).toMatchObject({
      inputConfiguration: { s3Uri: "s3://cleared-drafts/drafts/p/d" },
      outputConfiguration: { s3Uri: "s3://cleared-drafts/drafts/p/d.reading/" },
      dataAutomationConfiguration: { dataAutomationProjectArn: "arn:aws:bedrock:us-east-1:123456789012:data-automation-project/cleared" },
      dataAutomationProfileArn: "arn:aws:bedrock:us-east-1:123456789012:data-automation-profile/us.data-automation-v1",
    });
  });

  test.each([["Created"], ["InProgress"]])("while its status is %s the reading is still working", async (status) => {
    expect(await standIn({ status }).reader.result("j")).toEqual({ state: "working" });
  });

  test.each([["ServiceError"], ["ClientError"]])("a status of %s is a failed reading", async (status) => {
    expect(await standIn({ status }).reader.result("j")).toEqual({ state: "failed" });
  });

  test("on success the note is read, then the result it points to, both from the drafts bucket", async () => {
    const { reader, read } = standIn({ status: "Success", outputConfiguration: { s3Uri: "s3://cleared-drafts/drafts/p/d.reading/j/job_metadata.json" } });

    const done = await reader.result("j");

    expect(done).toMatchObject({ state: "done", speech: [{ text: "Hey everyone." }, {}, {}], screen: [{ text: "GLOW SERUM" }, {}, {}] });
    expect(read).toEqual(["drafts/p/d.reading/j/job_metadata.json", "drafts/p/d.reading/j/result.json"]);
  });

  test("a result said to be in some other bucket is not fetched", async () => {
    const { reader } = standIn({ status: "Success", outputConfiguration: { s3Uri: "s3://someone-elses-bucket/job_metadata.json" } });

    await expect(reader.result("j")).rejects.toThrow();
  });
});
