import { describe, expect, test } from "bun:test";
import { localLinkKeys } from "./link-keys";

const key = (fill: number) => Buffer.alloc(32, fill).toString("base64");
const salt = (fill: number) => Buffer.alloc(32, fill).toString("base64url");

describe("DS-FR-32 a link's token is worked out again, never stored", () => {
  test("the same salt gives the same token every time", async () => {
    const keys = localLinkKeys(key(1));

    expect(await keys.token(salt(7))).toBe(await keys.token(salt(7)));
  });

  test("another link's salt, or another key, gives another token", async () => {
    const keys = localLinkKeys(key(1));
    const token = await keys.token(salt(7));

    expect(await keys.token(salt(8))).not.toBe(token);
    expect(await localLinkKeys(key(2)).token(salt(7))).not.toBe(token);
  });
});

describe("DS-BR-11 a link's token cannot be guessed", () => {
  test("it is 256 bits, safe to put in an address, and is not the salt", async () => {
    const token = await localLinkKeys(key(1)).token(salt(7));

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toBe(salt(7));
  });

  test("a key that is not 32 bytes is refused when the service starts", () => {
    expect(() => localLinkKeys(Buffer.alloc(16, 1).toString("base64"))).toThrow();
  });
});
