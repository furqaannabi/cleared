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
    return { sent, storage: createS3Storage({ bucket: "sponing-drafts", region: "us-east-1", client: client as never }) };
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
      { Bucket: "sponing-drafts", Prefix: "drafts/p/d", ContinuationToken: undefined },
      { Bucket: "sponing-drafts", Prefix: "drafts/p/d", ContinuationToken: "more" },
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

  test("a small object is read whole, and one that is not there reads as nothing", async () => {
    const there = standIn({ GetObjectCommand: () => ({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } }) });
    expect(await there.storage.read("drafts/p/d.heard.json")).toEqual(new Uint8Array([1, 2, 3]));
    expect(there.sent[0]).toEqual({ name: "GetObjectCommand", input: { Bucket: "sponing-drafts", Key: "drafts/p/d.heard.json" } });

    const missing = standIn({
      GetObjectCommand: () => {
        throw Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" });
      },
    });
    expect(await missing.storage.read("drafts/p/none")).toBeUndefined();
  });

  test("a failure of the bucket itself is not mistaken for nothing being there", async () => {
    const down = standIn({
      GetObjectCommand: () => {
        throw Object.assign(new Error("Service Unavailable"), { name: "ServiceUnavailable" });
      },
    });

    expect(down.storage.read("drafts/p/d.heard.json")).rejects.toThrow("Service Unavailable");
  });

  test("an object is named for AWS's own services by bucket and key", () => {
    expect(standIn().storage.uri("drafts/p/d")).toBe("s3://sponing-drafts/drafts/p/d");
  });
});
