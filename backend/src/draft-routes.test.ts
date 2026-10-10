/** Sending a draft, and the limits on drafts, through the app (draft check and review spec DR-FR-01 to DR-FR-09). */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

const at = (iso: string) => new Date(iso);
/** A pretend video file of this many bytes. What it "is" comes from the stand-in for reading files. */
const video = (bytes = 2_000) => ({ bytes: new Uint8Array(bytes).fill(7) });
const sendDraft = (browser: Browser, post: string, file = video(), name: string | null = "glow-draft.mp4") =>
  browser.send("POST", `/deliverables/${post}/draft${name === null ? "" : `?fileName=${encodeURIComponent(name)}`}`, { file });
const check = (post: string) => prisma.draftCheck.findUnique({ where: { deliverableId: post } });
describe("DR-FR-01, DR-FR-02 sending a draft", () => {
  test("the creator sends a video for a held post: it is stored, and its check is started as a job", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    await prisma.job.deleteMany();

    const response = await sendDraft(sam, post, video(2_000));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deliverableId: post, state: "checking", run: 0 });
    expect([...world.storage.files.values()].map((file) => file.byteLength)).toEqual([2_000]);
    const [draft] = await prisma.draft.findMany();
    expect(draft).toMatchObject({ deliverableId: post, fileName: "glow-draft.mp4", sizeBytes: 2_000n, durationSec: 60 });
    expect(await check(post)).toMatchObject({ phase: "checking", run: 0, draftId: draft!.id, checkStartedAt: at("2026-10-09T09:00:00Z") });
    expect(await prisma.job.findMany()).toMatchObject([{ name: "check_draft", payload: { deliverableId: post, draftId: draft!.id } }]);
  });

  test("the file is stored under a key the service makes, never one made from its name", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    const name = '../../etc/passwd <script>alert(1)</script>.mp4';

    expect((await sendDraft(sam, post, video(), name)).status).toBe(200);

    const [draft] = await prisma.draft.findMany();
    expect(draft!.fileName).toBe(name);
    expect(draft!.storageKey).toBe(`drafts/${post}/${draft!.id}`);
    expect([...world.storage.files.keys()]).toEqual([draft!.storageKey]);
  });

  test("a file sent with no name, or a very long one, still has a short plain name", async () => {
    const world = heldWorld();
    const { sam, posts } = await world.heldPost({ platforms: ["youtube_video", "youtube_short"] });

    await sendDraft(sam, posts[0]!, video(), null);
    await sendDraft(sam, posts[1]!, video(), `${"x".repeat(500)}.mp4`);

    const names = (await prisma.draft.findMany({ orderBy: { createdAt: "asc" } })).map((draft) => draft.fileName);
    expect(names.sort((a, b) => a.length - b.length)).toEqual(["draft", "x".repeat(200)]);
  });

  test("a post that is agreed but not yet held takes no draft", async () => {
    const world = heldWorld();
    const { sam, post } = await world.agreedDeal(await world.creator(), { held: false });

    const response = await sendDraft(sam, post);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_held" } });
    expect(world.storage.everStored).toEqual([]);
  });

  test("a post whose hold was released takes no draft", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    await world.money.cancel(post, "creator");

    const response = await sendDraft(sam, post);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "released" } });
    expect(world.storage.everStored).toEqual([]);
  });

  test("while a check is running, another draft is refused and nothing of it is kept", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    await sendDraft(sam, post);

    const response = await sendDraft(sam, post);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "check_running" } });
    expect(world.storage.everStored).toHaveLength(1);
    expect(await prisma.draft.count()).toBe(1);
  });

  test("only the post's own creator can send one: not another creator, not the brand, not a stranger", async () => {
    const world = heldWorld();
    const { maya, post } = await world.heldPost();

    expect((await sendDraft(await world.creator("Ada Okafor"), post)).status).toBe(404);
    expect((await sendDraft(await world.creator("Ada Okafor"), "no-such-post")).status).toBe(404);
    expect((await sendDraft(maya, post)).status).toBe(401);
    expect((await sendDraft(world.visitor(), post)).status).toBe(401);
    expect(world.storage.everStored).toEqual([]);
  });
});

describe("DR-BR-17 an upload is accepted only from Cleared's own app, and is cut off at the size limit", () => {
  test("a file posted from another site, or from no site, is refused before any of it is read", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();

    for (const origin of ["https://evil.example", null]) {
      const response = await sam.send("POST", `/deliverables/${post}/draft?fileName=x.mp4`, { file: video(), origin });
      expect(response.status).toBe(403);
    }
    expect(world.storage.everStored).toEqual([]);
  });

  test("a file over the size limit is refused and nothing of it is kept", async () => {
    const world = heldWorld({ drafts: { maxBytes: 5_000 } });
    const { sam, post } = await world.heldPost();

    const response = await sendDraft(sam, post, video(5_001));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: { code: "file_too_large" } });
    expect(world.storage.files.size).toBe(0);
    expect(await prisma.draft.count()).toBe(0);
    expect(world.media.probed).toEqual([]);
    // The post is as it was, so the right file can be sent straight away.
    expect((await sendDraft(sam, post, video(5_000))).status).toBe(200);
  });

  test("every other route turns away a body far larger than anything it expects", async () => {
    const world = heldWorld();
    const sam = await world.creator();

    const response = await sam.send("POST", "/deals", { body: { brandName: "x".repeat(2_000_000), deliverables: [{ platform: "youtube_video" }] } });

    expect(response.status).toBe(413);
  });
});

describe("DR-FR-03, DR-FR-04 the file itself", () => {
  test("it is read through a short-lived address, not trusted by its name or the type the browser claims", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.media.file = { format: "other", durationSec: 30 };

    const response = await sam.send("POST", `/deliverables/${post}/draft?fileName=really-a-video.mp4`, { file: { ...video(), type: "video/mp4" } });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { code: "file_format" } });
    expect(world.media.probed).toHaveLength(1);
    expect(world.media.probed[0]).not.toContain("really-a-video");
    expect(world.storage.addresses[0]!.seconds).toBeLessThanOrEqual(15 * 60);
  });

  test.each([
    ["cannot be read as a video", "unreadable" as const, { code: "file_unreadable" }],
    ["is not an MP4 or MOV", { format: "other" as const, durationSec: 60 }, { code: "file_format" }],
    ["is longer than 15 minutes", { format: "mov" as const, durationSec: 900.5 }, { code: "file_too_long", lengthSec: 900.5, lengthCapSec: 900 }],
  ])("a file that %s is refused, deleted, and reported on the post as a file failure", async (_why, file, error) => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    await prisma.job.deleteMany();
    world.media.file = file;

    const response = await sendDraft(sam, post);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error });
    expect(world.storage.everStored).toHaveLength(1);
    expect(world.storage.files.size).toBe(0);
    expect(await prisma.draft.count()).toBe(0);
    expect(await prisma.job.count()).toBe(0);
    expect(await check(post)).toMatchObject({ phase: "no_draft", run: 0, fileFailure: { reason: error.code.replace("file_", ""), fileName: "glow-draft.mp4" } });
  });

  test("a file exactly at the length cap, MP4 or MOV, is taken", async () => {
    const world = heldWorld();
    const { sam, posts } = await world.heldPost({ platforms: ["youtube_video", "youtube_short"] });

    world.media.file = { format: "mp4", durationSec: 900 };
    expect((await sendDraft(sam, posts[0]!)).status).toBe(200);
    world.media.file = { format: "mov", durationSec: 12 };
    expect((await sendDraft(sam, posts[1]!)).status).toBe(200);
  });

  test("a file failure is not a check: the run before it stands exactly as it was, and it counts for nothing", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    await sendDraft(sam, post);
    await world.finishChecks();
    const before = await check(post);
    expect(before).toMatchObject({ phase: "done", run: 1 });
    world.media.file = "unreadable";

    expect((await sendDraft(sam, post, video(), "broken.mp4")).status).toBe(422);

    expect(await check(post)).toEqual({ ...before!, fileFailure: { reason: "unreadable", fileName: "broken.mp4" } });
    expect(await prisma.draftUsage.count()).toBe(1);
    expect(await prisma.draft.count()).toBe(1);
  });

  test("the next draft that is accepted clears the file failure", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.media.file = "unreadable";
    await sendDraft(sam, post);
    world.media.file = { format: "mp4", durationSec: 60 };

    expect((await sendDraft(sam, post)).status).toBe(200);

    expect((await check(post))!.fileFailure).toBeNull();
  });
});

describe("DR-FR-06 to DR-FR-09 limits on drafts", () => {
  /** How many drafts the stand-in storage was ever handed. */
  const stored = (world: HeldWorld) => world.storage.everStored.length;

  test("a post can be checked 10 times; the eleventh draft is refused and nothing of it is read", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    for (let run = 1; run <= 10; run++) {
      expect((await sendDraft(sam, post)).status).toBe(200);
      await world.finishChecks();
    }
    expect(await check(post)).toMatchObject({ phase: "done", run: 10 });

    const response = await sendDraft(sam, post);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: { code: "draft_limit", field: "post" } });
    expect(stored(world)).toBe(10);
  });

  test("across everyone, the minutes checked in a day are capped; the answer says when the limit lifts", async () => {
    const world = heldWorld({ drafts: { dailySeconds: 100 } });
    const { sam, posts } = await world.heldPost({ platforms: ["youtube_video", "youtube_short"] });
    const ada = await world.agreedDeal(await world.creator("Ada Okafor"));
    world.media.file = { format: "mp4", durationSec: 60 };
    expect((await sendDraft(sam, posts[0]!)).status).toBe(200);

    world.timeIs("2026-10-09T15:00:00Z");
    // 60 seconds are used. Another 41 would pass 100; another 40 would not.
    world.media.file = { format: "mp4", durationSec: 41 };
    const refused = await sendDraft(ada.sam, ada.post);

    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: { code: "draft_limit", field: "overall", resetsAt: "2026-10-10T09:00:00.000Z" } });
    expect(world.storage.files.size).toBe(1);
    expect(await prisma.draft.count()).toBe(1);
    expect(await check(ada.post)).toMatchObject({ phase: "no_draft" });

    world.media.file = { format: "mp4", durationSec: 40 };
    expect((await sendDraft(ada.sam, ada.post)).status).toBe(200);

    // A day after the first draft, its minute no longer counts.
    world.timeIs("2026-10-10T09:00:00Z");
    world.media.file = { format: "mp4", durationSec: 60 };
    expect((await sendDraft(sam, posts[1]!)).status).toBe(200);
  });

  test("once the day's minutes are used up, a draft is refused before any of it is stored", async () => {
    const world = heldWorld({ drafts: { dailySeconds: 60 } });
    const { sam, posts } = await world.heldPost({ platforms: ["youtube_video", "youtube_short"] });
    await sendDraft(sam, posts[0]!);

    const response = await sendDraft(sam, posts[1]!);

    expect(response.status).toBe(429);
    expect(stored(world)).toBe(1);
  });

  test("a demo account's drafts can be 3 minutes at most", async () => {
    const world = heldWorld();
    const { sam, post } = await world.agreedDeal(await world.demo());
    world.media.file = { format: "mp4", durationSec: 181 };

    const response = await sendDraft(sam, post);

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { code: "file_too_long", lengthSec: 181, lengthCapSec: 180 } });
    world.media.file = { format: "mp4", durationSec: 180 };
    expect((await sendDraft(sam, post)).status).toBe(200);
  });

  test("a demo account can have 3 drafts checked in total; the fourth is refused before it is stored", async () => {
    const world = heldWorld();
    const { sam, post } = await world.agreedDeal(await world.demo());
    for (let draft = 1; draft <= 3; draft++) {
      expect((await sendDraft(sam, post)).status).toBe(200);
      await world.finishChecks();
    }

    const response = await sendDraft(sam, post);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: { code: "draft_limit", field: "demo" } });
    expect(stored(world)).toBe(3);
  });

  test("a draft that was refused counts against no limit", async () => {
    const world = heldWorld({ drafts: { maxBytes: 5_000 } });
    const { sam, post } = await world.agreedDeal(await world.demo());
    world.media.file = "unreadable";
    for (let attempt = 0; attempt < 4; attempt++) await sendDraft(sam, post);
    await sendDraft(sam, post, video(5_001));

    expect(await prisma.draftUsage.count()).toBe(0);
    world.media.file = { format: "mp4", durationSec: 60 };
    expect((await sendDraft(sam, post)).status).toBe(200);
  });
});
