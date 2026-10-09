/**
 * Works out an invite link's token from that link's salt (deal set-up spec DS-FR-32, DS-BR-11). The
 * database keeps the salt and a hash of the token, never the token, and the key is never in the
 * database. So a copy of the database opens no deal, and the creator can still be shown their link again
 * (docs/decisions/2026-10-09-an-invite-link-is-worked-out-again.md).
 *
 * `localLinkKeys` takes its key from the environment. In production the same interface is to be backed
 * by AWS KMS; that arrives with the deployment spec.
 */
export interface LinkKeys {
  /** The token for the link with this salt. The same salt always gives the same token. */
  token(salt: string): Promise<string>;
}

/** HMAC-SHA-256 over the salt. `keyBase64` is the 32-byte token key, given as base64. */
export function localLinkKeys(keyBase64: string): LinkKeys {
  const raw = Buffer.from(keyBase64, "base64");
  if (raw.length !== 32) throw new Error("The token key must be 32 bytes, given as base64. See backend/.env.example.");
  // A key of its own, derived from the token key, so signing links and encrypting tokens never share one.
  const key = crypto.subtle.importKey("raw", raw, "HKDF", false, ["deriveKey"]).then((base) =>
    crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: new TextEncoder().encode("cleared invite link v1") },
      base,
      { name: "HMAC", hash: "SHA-256", length: 256 },
      false,
      ["sign"],
    ),
  );

  return {
    async token(salt) {
      const mac = await crypto.subtle.sign("HMAC", await key, Buffer.from(salt, "base64url"));
      return Buffer.from(mac).toString("base64url");
    },
  };
}
