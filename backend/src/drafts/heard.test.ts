/**
 * What was said in a draft, kept beside its file (Instagram Reels spec, "The approved draft's reading
 * is not made again"; IG-FR-21, DR-BR-19). The match of a live Reel reads it from there.
 */
import { describe, expect, test } from "bun:test";
import { FakeStorage } from "../../test/fake-storage";
import type { TimedText } from "../checks/text";
import { heardIn, heardKey, keepHeard } from "./heard";

const KEY = "drafts/post-1/draft-1";
const speech: TimedText[] = [
  { text: "Today's video is sponsored by Glow Serum.", startSec: 12, endSec: 16.5 },
  { text: "Use code GLOW20 for twenty percent off.", startSec: 40, endSec: 44 },
];
const bytes = (text: string) => new TextEncoder().encode(text);

describe("what was said in a draft is kept, and read back as it was", () => {
  test("kept and read back", async () => {
    const storage = new FakeStorage();

    await keepHeard(storage, KEY, speech);

    expect(await heardIn(storage, KEY)).toEqual(speech);
  });

  test("DR-BR-19 it is kept under the draft's own key, so deleting the draft deletes it", async () => {
    const storage = new FakeStorage();
    await keepHeard(storage, KEY, speech);
    expect(heardKey(KEY).startsWith(KEY)).toBe(true);

    await storage.deleteUnder(KEY);

    expect(await heardIn(storage, KEY)).toBeUndefined();
  });

  test("a draft in which nothing was said keeps that too: it is not the same as nothing kept", async () => {
    const storage = new FakeStorage();
    await keepHeard(storage, KEY, []);

    expect(await heardIn(storage, KEY)).toEqual([]);
    expect(await heardIn(storage, "drafts/post-1/another")).toBeUndefined();
  });
});

describe("what is read back is checked before it is used", () => {
  test.each([
    ["not JSON at all", "<html>not found</html>"],
    ["JSON of another shape", '{"speech":"hello"}'],
    ["a piece with no times", '[{"text":"hello"}]'],
    ["a piece whose time is not a number", '[{"text":"hello","startSec":"0","endSec":1}]'],
  ])("%s reads as nothing kept", async (_what, stored) => {
    const storage = new FakeStorage();
    storage.files.set(heardKey(KEY), bytes(stored));

    expect(await heardIn(storage, KEY)).toBeUndefined();
  });

  test("anything beside the text and its times is dropped", async () => {
    const storage = new FakeStorage();
    storage.files.set(heardKey(KEY), bytes('[{"text":"hello","startSec":0,"endSec":1,"verdict":"passed"}]'));

    expect(await heardIn(storage, KEY)).toEqual([{ text: "hello", startSec: 0, endSec: 1 }]);
  });
});
