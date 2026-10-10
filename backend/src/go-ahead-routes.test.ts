/** The go-ahead, through the app (publish to paid spec PT-FR-01 to PT-FR-07, PT-BR-05). */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase, type HeldWorld } from "../test/held-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

const VIDEO = "dQw4w9WgXcQ";
const LINK = `https://youtu.be/${VIDEO}`;
const video = { bytes: new Uint8Array(2_000).fill(7) };

interface Post {
  state: string;
  goAhead?: { state: string; endsAt?: string; until?: string };
  hold: { stage: string };
  [field: string]: unknown;
}

/** A held post whose draft the brand has approved: a one-minute file of 2,000 bytes. Nothing is on YouTube yet. */
async function approved(world: HeldWorld, options: { approve?: boolean } = {}) {
  const held = await world.heldPost();
  await held.sam.send("POST", `/deliverables/${held.post}/draft?fileName=glow-draft.mp4`, { file: video });
  await world.finishChecks();
  if (options.approve !== false) {
    expect((await held.maya.send("POST", `/brand/deals/${held.deal.id}/deliverables/${held.post}/approve`)).status).toBe(200);
  }
  return {
    ...held,
    goAhead: (videoUrl: unknown = LINK, browser: Browser = held.sam) => browser.send("POST", `/deliverables/${held.post}/go-ahead`, { body: { videoUrl } }),
    readPost: async () => (await (await held.sam.send("GET", `/deliverables/${held.post}`)).json()) as Post,
  };
}

const paypalCalls = (world: HeldWorld) => world.paypal.calls.length;
const recorded = (post: string) => prisma.postVideo.findUnique({ where: { deliverableId: post } });

describe("PT-FR-01, PT-FR-05 asking for the go-ahead", () => {
  test("with the approved file on the creator's channel, the hold is confirmed and the creator can post until a stated time", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);
    const before = paypalCalls(world);

    const response = await post.goAhead();

    expect(response.status).toBe(200);
    const read = (await response.json()) as Post;
    expect(read.goAhead).toEqual({ state: "go", endsAt: expect.any(String) });
    expect(new Date(read.goAhead!.endsAt!).getTime()).toBeGreaterThan(world.now().getTime());
    expect(read).toMatchObject({ state: "posting", hold: { stage: "confirmed" } });
    expect(paypalCalls(world)).toBe(before + 1);
    expect(await recorded(post.post)).toMatchObject({ videoId: VIDEO, fileMatch: "same", seenPublicAt: null });
  });

  test("the video is read from YouTube with the creator's own stored access, by the id in the link", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);

    await post.goAhead(`https://www.youtube.com/watch?v=${VIDEO}&feature=shared`);

    expect(world.youtube.reads).toEqual([{ refreshToken: "refresh-sam", videoId: VIDEO }]);
  });

  test("before the draft is approved there is no go-ahead, and neither YouTube nor PayPal is asked", async () => {
    const world = heldWorld();
    const post = await approved(world, { approve: false });
    world.youtube.has(VIDEO);
    const before = paypalCalls(world);

    const response = await post.goAhead();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_approved" } });
    expect(world.youtube.reads).toEqual([]);
    expect(paypalCalls(world)).toBe(before);
  });

  test("only the post's own creator can ask", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);

    expect((await post.goAhead(LINK, await world.creator("Ada Okafor"))).status).toBe(404);
    expect((await post.goAhead(LINK, post.maya)).status).toBe(401);
    expect((await post.goAhead(LINK, world.visitor())).status).toBe(401);
    expect(world.youtube.reads).toEqual([]);
    expect(await recorded(post.post)).toBeNull();
  });
});

describe("PT-FR-01, PT-FR-02, PT-BR-05 no go-ahead without a video Cleared has read and matched", () => {
  test.each([
    ["text that is not a link", "my video", 400, { code: "not_a_youtube_link", field: "videoUrl" }],
    ["a link to another site", "https://vimeo.com/123456789", 400, { code: "not_a_youtube_link", field: "videoUrl" }],
    ["no link at all", undefined, 400, { code: "invalid", field: "videoUrl" }],
  ])("%s is refused, and nothing is read or asked", async (_what, link, status, error) => {
    const world = heldWorld();
    const post = await approved(world);
    const before = paypalCalls(world);

    const response = link === undefined ? await post.sam.send("POST", `/deliverables/${post.post}/go-ahead`, { body: {} }) : await post.goAhead(link);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
    expect(world.youtube.reads).toEqual([]);
    expect(paypalCalls(world)).toBe(before);
  });

  test.each([
    ["does not exist", undefined, "video_not_found"],
    ["is private, so the brand could never see it", { privacy: "private" as const }, "video_private"],
    ["is on someone else's channel", { channelId: "channel-ada" }, "not_your_channel"],
    ["is a different size from the approved file", { fileSizeBytes: 2_001 }, "not_the_approved_file"],
    ["is a different length from the approved file", { durationSec: 75 }, "not_the_approved_file"],
  ])("a video that %s is refused with its own reason, and PayPal is not asked", async (_what, record, code) => {
    const world = heldWorld();
    const post = await approved(world);
    if (record) world.youtube.has(VIDEO, record);
    const before = paypalCalls(world);

    const response = await post.goAhead();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code } });
    expect(paypalCalls(world)).toBe(before);
    expect(await recorded(post.post)).toBeNull();
    expect(await post.readPost()).toMatchObject({ state: "approved" });
    expect(await post.readPost()).not.toHaveProperty("goAhead");
  });
});

describe("PT-FR-03 unlisted or already public", () => {
  test("a video that is already public is accepted: the creator published before asking", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO, { privacy: "public" });

    const response = await post.goAhead();

    expect(response.status).toBe(200);
    expect(((await response.json()) as Post).goAhead).toMatchObject({ state: "go" });
  });
});

describe("PT-FR-04 when YouTube will not say", () => {
  test("a video whose file record YouTube does not return is accepted on its channel alone, and the match is recorded as unknown", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO, { fileSizeBytes: undefined, durationSec: undefined });

    expect((await post.goAhead()).status).toBe(200);

    expect(await recorded(post.post)).toMatchObject({ videoId: VIDEO, fileMatch: "unknown" });
  });
});

describe("PT-FR-05 the money path's answer is passed on as it is", () => {
  test("a hold PayPal cannot confirm gives no go-ahead: the creator is told not to post, and can ask again", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);
    const hold = (await world.money.view(post.post))!.hold;
    // The hold ends on PayPal's side without Cleared knowing.
    await world.paypal.cancelHold(hold.state === "held" ? hold.reference : "");

    const response = await post.goAhead();

    expect(response.status).toBe(200);
    expect((await response.json()) as Post).toMatchObject({ state: "approved", goAhead: { state: "not_confirmed" }, hold: { stage: "held" } });
    expect((await post.goAhead()).status).toBe(200);
  });

  test("a refusal from the money path is passed on with its reason", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);
    // The creator looks at their post a few days before the deadline, then asks an hour after it.
    world.timeIs("2026-10-20T09:00:00Z");
    await post.readPost();
    world.timeIs("2026-10-24T05:00:00Z");

    const response = await post.goAhead();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "deadline_passed" } });
  });

  test("a post whose hold was released gets no go-ahead, and YouTube is not asked", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);
    await world.money.cancel(post.post, "brand");

    const response = await post.goAhead();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_held" } });
    expect(world.youtube.reads).toEqual([]);
  });
});

describe("PT-FR-06 asking again", () => {
  test("a go-ahead that ran out is reported, the post is no longer ready to post, and the creator can ask again", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);
    const first = ((await (await post.goAhead()).json()) as Post).goAhead!;

    world.timeIs(first.endsAt!);
    await world.runJobs();

    expect(await post.readPost()).toMatchObject({ state: "approved", goAhead: { state: "ended" }, hold: { stage: "held" } });
    // PayPal's guarantee of the hold is nearly over, so the money path says when the hold can be renewed.
    const again = ((await (await post.goAhead()).json()) as Post).goAhead!;
    expect(again).toEqual({ state: "wait", until: "2026-10-12T09:00:00.000Z" });
    expect(await post.readPost()).toMatchObject({ state: "approved" });

    world.timeIs(again.until!);
    expect(((await (await post.goAhead()).json()) as Post).goAhead).toMatchObject({ state: "go" });
  });

  test("until a post is published the creator can give a different video, which is read and matched afresh", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);
    world.youtube.has("aaaaaaaaaaa");
    world.youtube.has("bbbbbbbbbbb", { fileSizeBytes: 5 });
    await post.goAhead();

    expect((await post.goAhead("https://youtu.be/aaaaaaaaaaa")).status).toBe(200);
    expect(await recorded(post.post)).toMatchObject({ videoId: "aaaaaaaaaaa" });

    // A wrong file is still refused, and the video already recorded stays.
    expect(await (await post.goAhead("https://youtu.be/bbbbbbbbbbb")).json()).toEqual({ error: { code: "not_the_approved_file" } });
    expect(await recorded(post.post)).toMatchObject({ videoId: "aaaaaaaaaaa" });
  });
});

describe("PT-FR-07 lost access to YouTube", () => {
  test("when the creator's access no longer works the go-ahead is refused with \"reconnect YouTube\", and PayPal is not asked", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);
    world.youtube.lostAccess.add("refresh-sam");
    const before = paypalCalls(world);

    const response = await post.goAhead();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "reconnect_youtube" } });
    expect(paypalCalls(world)).toBe(before);
    expect(await recorded(post.post)).toBeNull();
  });

  test("a creator with no real YouTube connection is told the same", async () => {
    const world = heldWorld();
    const post = await approved(world);
    await prisma.connectedAccount.updateMany({ data: { refreshTokenEncrypted: null } });

    expect(await (await post.goAhead()).json()).toEqual({ error: { code: "reconnect_youtube" } });
    expect(world.youtube.reads).toEqual([]);
  });

  test("when YouTube itself fails, the creator is asked to try again, and PayPal is not asked", async () => {
    const world = heldWorld();
    const post = await approved(world);
    world.youtube.has(VIDEO);
    world.youtube.down = true;
    const before = paypalCalls(world);

    const response = await post.goAhead();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "youtube_unavailable" } });
    expect(paypalCalls(world)).toBe(before);
  });
});
