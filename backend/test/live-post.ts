/**
 * Quick ways to a post after its draft is approved (publish to paid spec): one whose creator has the
 * go-ahead, and one that is public with its live check waiting. Everything goes through the real
 * routes, over the stand-ins of the held-post world.
 */
import { expect } from "bun:test";
import { prisma } from "../src/db";
import type { Browser } from "./browser";
import type { HeldWorld } from "./held-post";

export const VIDEO = "dQw4w9WgXcQ";
const file = { bytes: new Uint8Array(2_000).fill(7) };
/** A description that meets the one written item every deal here has: the link. */
export const GOOD = "My two weeks with Glow Serum.\nhttps://glow.example/sam";

/**
 * A held post whose draft the brand approved and whose creator has the go-ahead: the approved file is
 * on their channel as an unlisted video, with a description that meets the checklist.
 */
export async function goAheadGiven(world: HeldWorld) {
  const held = await world.heldPost();
  await held.sam.send("POST", `/deliverables/${held.post}/draft?fileName=glow-draft.mp4`, { file });
  await world.finishChecks();
  expect((await held.maya.send("POST", `/brand/deals/${held.deal.id}/deliverables/${held.post}/approve`)).status).toBe(200);
  world.youtube.has(VIDEO, { description: GOOD, paidPromotion: true });
  expect((await held.sam.send("POST", `/deliverables/${held.post}/go-ahead`, { body: { videoUrl: `https://youtu.be/${VIDEO}` } })).status).toBe(200);
  world.youtube.reads.length = 0;
  return {
    ...held,
    posted: (browser: Browser = held.sam) => browser.send("POST", `/deliverables/${held.post}/posted`),
    again: (browser: Browser = held.sam) => browser.send("POST", `/deliverables/${held.post}/live-check/again`),
    money: async () => (await world.money.view(held.post))!,
    video: () => prisma.postVideo.findUniqueOrThrow({ where: { deliverableId: held.post } }),
    check: () => prisma.liveCheck.findUnique({ where: { deliverableId: held.post } }),
    results: () => prisma.liveCheckItem.findMany({ where: { deliverableId: held.post }, orderBy: { position: "asc" } }),
  };
}

/** The creator has posted, and said so: the video is public and a live check is waiting to run. */
export async function postedPublic(world: HeldWorld, video: Parameters<HeldWorld["youtube"]["edit"]>[1] = {}) {
  const post = await goAheadGiven(world);
  world.youtube.edit(VIDEO, { privacy: "public", ...video });
  world.timeIs("2026-10-09T12:00:00Z");
  expect((await post.posted()).status).toBe(200);
  world.youtube.reads.length = 0;
  return post;
}
