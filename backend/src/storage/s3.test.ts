/** The S3 storage port over a stand-in client. Against a real bucket it is not yet proven: none exists. */
import { describe, expect, test } from "bun:test";
import { capped, createS3Storage } from "./s3";

const stream = (...chunks: number[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });

async function drain(body: ReadableStream<Uint8Array>) {
  let bytes = 0;
  for await (const chunk of body) bytes += chunk.byteLength;
  return bytes;
}

describe("DR-FR-02 a file is cut off at the size limit as it arrives", () => {
  test("a stream within the limit passes through whole, including one exactly at it", async () => {
    expect(await drain(capped(stream(400, 400), 1000))).toBe(800);
    expect(await drain(capped(stream(500, 500), 1000))).toBe(1000);
  });

  test("a stream past the limit fails as soon as it passes it", async () => {
    await expect(drain(capped(stream(500, 500, 1), 1000))).rejects.toThrow();
    await expect(drain(capped(stream(1001), 1000))).rejects.toThrow();
  });
});

describe("what S3 is asked", () => {
  /** A client that remembers every command it is sent and answers what the test says. */
  function standIn(answers: Record<string, (input: Record<string, unknown>) => unknown> = {}) {
    const sent: { name: string; input: Record<string, unknown> }[] = [];
    const client = {
      async send(command: { constructor: { name: string }; input: Record<string, unknown> }) {
        sent.push({ name: command.constructor.name, input: command.input });
        return answers[command.constructor.name]?.(command.input) ?? {};
      },
    };
    return { sent, storage: createS3Storage({ bucket: "cleared-drafts", region: "us-east-1", client: client as never }) };
  }

  test("everything under a prefix is deleted, page after page, and nothing outside it is named", async () => {
    let page = 0;
    const { sent, storage } = standIn({
      ListObjectsV2Command: () =>
        ++page === 1
          ? { Contents: [{ Key: "drafts/p/d" }, { Key: "drafts/p/d.reading/job.json" }], IsTruncated: true, NextContinuationToken: "more" }
          : { Contents: [{ Key: "drafts/p/d.reading/result.json" }], IsTruncated: false },
    });

    await storage.deleteUnder("drafts/p/d");

    expect(sent.filter((each) => each.name === "ListObjectsV2Command").map((each) => each.input)).toEqual([
      { Bucket: "cleared-drafts", Prefix: "drafts/p/d", ContinuationToken: undefined },
      { Bucket: "cleared-drafts", Prefix: "drafts/p/d", ContinuationToken: "more" },
    ]);
    expect(sent.filter((each) => each.name === "DeleteObjectsCommand").map((each) => (each.input.Delete as { Objects: unknown }).Objects)).toEqual([
      [{ Key: "drafts/p/d" }, { Key: "drafts/p/d.reading/job.json" }],
      [{ Key: "drafts/p/d.reading/result.json" }],
    ]);
  });

  test("a prefix with nothing under it deletes nothing", async () => {
    const { sent, storage } = standIn({ ListObjectsV2Command: () => ({ Contents: [], IsTruncated: false }) });

    await storage.deleteUnder("drafts/p/none");

    expect(sent.map((each) => each.name)).toEqual(["ListObjectsV2Command"]);
  });

  test("a copy leaves the first file where it is, and reports the size of the new one", async () => {
    const { sent, storage } = standIn({ HeadObjectCommand: () => ({ ContentLength: 900 }) });

    expect(await storage.copy("samples/demo clip.mp4", "drafts/p/d")).toEqual({ bytes: 900 });

    expect(sent[0]).toEqual({ name: "CopyObjectCommand", input: { Bucket: "cleared-drafts", Key: "drafts/p/d", CopySource: "cleared-drafts/samples/demo%20clip.mp4" } });
    expect(sent.map((each) => each.name)).not.toContain("DeleteObjectCommand");
  });

  test("an object is named for AWS's own services by bucket and key", () => {
    expect(standIn().storage.uri("drafts/p/d")).toBe("s3://cleared-drafts/drafts/p/d");
  });
});
