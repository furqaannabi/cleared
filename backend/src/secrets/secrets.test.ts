import { describe, expect, test } from "bun:test";
import { localSecrets } from "./secrets";

const key = (fill: number) => Buffer.alloc(32, fill).toString("base64");

describe("DS-BR-14 a token is encrypted before it is stored", () => {
  test("what is stored is not the token, and comes back as the token", async () => {
    const secrets = localSecrets(key(1));

    const stored = await secrets.encrypt("google-refresh-token");

    expect(stored).not.toContain("google-refresh-token");
    expect(await secrets.decrypt(stored)).toBe("google-refresh-token");
  });

  test("the same token is stored differently each time", async () => {
    const secrets = localSecrets(key(1));

    expect(await secrets.encrypt("google-refresh-token")).not.toBe(await secrets.encrypt("google-refresh-token"));
  });

  test("a stored value that has been changed, or was made with another key, cannot be read", async () => {
    const secrets = localSecrets(key(1));
    const stored = await secrets.encrypt("google-refresh-token");
    const changed = `${stored.slice(0, -4)}AAAA`;

    await expect(secrets.decrypt(changed)).rejects.toThrow();
    await expect(localSecrets(key(2)).decrypt(stored)).rejects.toThrow();
    await expect(secrets.decrypt("not-a-stored-value")).rejects.toThrow();
  });

  test("a key that is not 32 bytes is refused at once", () => {
    expect(() => localSecrets(Buffer.alloc(16).toString("base64"))).toThrow();
    expect(() => localSecrets("")).toThrow();
  });
});
