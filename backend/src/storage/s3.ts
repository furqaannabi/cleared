/**
 * The real storage port: one private S3 bucket (draft check and review spec, "Storage is one private
 * S3 bucket"; docs/decisions/2026-10-09-drafts-uploaded-through-the-api-to-s3.md). Nothing in it is
 * public. A file is read only through an address signed for a short time (DR-BR-12).
 *
 * Not yet proven against a real bucket: none exists for this account.
 */
import { CopyObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Storage } from "./port";

/** Thrown inside the stream when a file runs past its limit, so the upload stops there. */
class TooLarge extends Error {}

/**
 * The same stream, cut off with an error as soon as more than `maxBytes` have passed through it. The
 * rest of the file is never read.
 */
export function capped(body: ReadableStream<Uint8Array>, maxBytes: number): ReadableStream<Uint8Array> {
  let bytes = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > maxBytes) controller.error(new TooLarge());
        else controller.enqueue(chunk);
      },
    }),
  );
}

/** What the rest of the service needs of S3 beyond the storage port: reading a small object whole, and naming one for AWS's own services. */
export interface S3Storage extends Storage {
  read(key: string): Promise<Uint8Array>;
  /** The object's address as AWS services take it: s3://bucket/key. Never a link anyone can open. */
  uri(key: string): string;
}

export function createS3Storage(config: { bucket: string; region: string; client?: S3Client }): S3Storage {
  const client = config.client ?? new S3Client({ region: config.region });
  const Bucket = config.bucket;

  return {
    async put(key, body, { maxBytes }) {
      let bytes = 0;
      const counted = capped(body, maxBytes).pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            bytes += chunk.byteLength;
            controller.enqueue(chunk);
          },
        }),
      );
      // Sent in parts as it arrives, so the whole file is never held in memory (DR-FR-02).
      const upload = new Upload({ client, params: { Bucket, Key: key, Body: counted } });
      try {
        await upload.done();
        return { bytes };
      } catch (error) {
        // Whatever stopped it, no part of the file is left behind.
        await upload.abort().catch(() => {});
        await client.send(new DeleteObjectCommand({ Bucket, Key: key })).catch(() => {});
        if (error instanceof TooLarge || bytes >= maxBytes) return "too_large";
        throw error;
      }
    },

    async copy(fromKey, toKey) {
      await client.send(new CopyObjectCommand({ Bucket, Key: toKey, CopySource: `${Bucket}/${encodeURIComponent(fromKey).replace(/%2F/g, "/")}` }));
      const copied = await client.send(new HeadObjectCommand({ Bucket, Key: toKey }));
      return { bytes: copied.ContentLength ?? 0 };
    },

    address: (key, seconds) => getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: seconds }),

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },

    async deleteUnder(prefix) {
      for (let token: string | undefined; ; ) {
        const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: token }));
        const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [{ Key: object.Key }] : []));
        if (keys.length) await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }));
        if (!page.IsTruncated || !page.NextContinuationToken) return;
        token = page.NextContinuationToken;
      }
    },

    async read(key) {
      const object = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!object.Body) throw new Error("The stored object has no content");
      return object.Body.transformToByteArray();
    },

    uri: (key) => `s3://${Bucket}/${key}`,
  };
}
