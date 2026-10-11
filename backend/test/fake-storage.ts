/** A stand-in for the bucket: files are kept in memory, and every address handed out is remembered. */
import type { Storage } from "../src/storage/port";

export class FakeStorage implements Storage {
  readonly files = new Map<string, Uint8Array>();
  /** Every address given out, with how long it was good for. */
  readonly addresses: { key: string; seconds: number }[] = [];
  /** Every key ever stored, including ones since deleted. */
  readonly everStored: string[] = [];

  async put(key: string, body: ReadableStream<Uint8Array>, options: { maxBytes: number }) {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for await (const chunk of body) {
      bytes += chunk.byteLength;
      // Cut off at the limit: the rest of the stream is never read, and nothing is kept.
      if (bytes > options.maxBytes) return "too_large" as const;
      chunks.push(chunk);
    }
    this.files.set(key, Buffer.concat(chunks));
    this.everStored.push(key);
    return { bytes };
  }

  async address(key: string, seconds: number) {
    this.addresses.push({ key, seconds });
    return `https://bucket.test/${key}?good-for=${seconds}`;
  }

  async delete(key: string) {
    this.files.delete(key);
  }

  async deleteUnder(prefix: string) {
    for (const key of [...this.files.keys()]) if (key.startsWith(prefix)) this.files.delete(key);
  }
}
