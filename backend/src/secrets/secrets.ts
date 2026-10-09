/**
 * Encrypts what must not sit in the database as it is: a creator's Google refresh token (deal set-up
 * spec DS-BR-14). The key is never in the database, so a copy of the database reads no token.
 *
 * `localSecrets` takes its key from the environment, for development and tests. In production the same
 * interface is to be backed by AWS KMS; that arrives with the deployment spec.
 */
export interface Secrets {
  encrypt(plain: string): Promise<string>;
  /** Throws if the value was not made by `encrypt` with this key, or has been changed since. */
  decrypt(stored: string): Promise<string>;
}

const VERSION = "v1";

/** AES-256-GCM with a 32-byte key given as base64. Each value gets its own random nonce. */
export function localSecrets(keyBase64: string): Secrets {
  const raw = Buffer.from(keyBase64, "base64");
  if (raw.length !== 32) throw new Error("The token key must be 32 bytes, given as base64. See backend/.env.example.");
  const key = crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);

  return {
    async encrypt(plain) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key, new TextEncoder().encode(plain));
      return [VERSION, Buffer.from(iv).toString("base64url"), Buffer.from(sealed).toString("base64url")].join(".");
    },
    async decrypt(stored) {
      const [version, iv, sealed] = stored.split(".");
      if (version !== VERSION || !iv || !sealed) throw new Error("A stored secret could not be read");
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: Buffer.from(iv, "base64url") },
        await key,
        Buffer.from(sealed, "base64url"),
      );
      return new TextDecoder().decode(plain);
    },
  };
}
