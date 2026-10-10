/**
 * Where drafts are kept (draft check and review spec DR-FR-02, DR-BR-12). The real one is a private S3
 * bucket; tests use a stand-in. Nothing stored is ever public: a file is reached only through an
 * address that works for a short time.
 */
export interface Storage {
  /**
   * Stores a stream under a key without holding it whole in memory. If the stream runs past
   * `maxBytes` it is cut off there, nothing is kept, and the answer is "too_large".
   */
  put(key: string, body: ReadableStream<Uint8Array>, options: { maxBytes: number }): Promise<{ bytes: number } | "too_large">;
  /** Copies one stored file to a new key, leaving the first as it was. */
  copy(fromKey: string, toKey: string): Promise<{ bytes: number }>;
  /** An address that reads the file for `seconds`, and then stops working. Never logged (DR-BR-18). */
  address(key: string, seconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  /** Deletes everything whose key starts with `prefix`. */
  deleteUnder(prefix: string): Promise<void>;
}
