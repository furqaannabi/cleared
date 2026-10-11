/**
 * The service's entry file, as a process manager loads it. pm2 loads it with require(), and a file
 * that waits at its top level cannot be loaded that way: the service then never starts.
 */
import { expect, test } from "bun:test";

test("nothing waits at the top level of the entry file, so it can be loaded with require()", async () => {
  const source = await Bun.file(new URL("./index.ts", import.meta.url)).text();

  // A statement at the top level starts at the first column.
  const waits = source.split("\n").filter((line) => /^(await\b|for await\b|(export\s+)?(const|let|var)\s[^=]*=\s*await\b)/.test(line));

  expect(waits).toEqual([]);
});

test("the entry file starts its own server: Bun serves a default export only for the file it was asked to run", async () => {
  const source = await Bun.file(new URL("./index.ts", import.meta.url)).text();

  expect(source).toContain("Bun.serve(");
  expect(source).not.toMatch(/^export default\b/m);
});
