/**
 * Quick ways to a Reel after its draft is approved (Instagram Reels spec): one that is posted on the
 * creator's own Instagram account, and one whose link was given so its live check is waiting.
 * Everything goes through the real routes, over the stand-ins of the held-post world.
 */
import { expect } from "bun:test";
import { prisma } from "../src/db";
import type { Browser } from "./browser";
import type { HeldWorld } from "./held-post";

export const CODE = "DAbC1dEfGhI";
export const LINK = `https://www.instagram.com/reel/${CODE}/?igsh=abc123`;
/** Instagram's own link for it, which is the one both sides are shown. */
export const REEL_URL = `https://www.instagram.com/reel/${CODE}/`;
/** A caption that meets the one written item every deal here has: the link. */
export const CAPTION = "Two weeks with Glow Serum.\nhttps://glow.example/sam";
const file = { bytes: new Uint8Array(2_000).fill(7) };

/** A held Reel whose draft was sent and checked. */
export async function checkedReel(world: HeldWorld) {
  const held = await world.heldPost({ platforms: ["instagram_reel"] });
  expect((await held.sam.send("POST", `/deliverables/${held.post}/draft?fileName=glow-reel.mp4`, { file })).status).toBe(200);
  await world.finishChecks();
  return held;
}

/** An approved Reel whose creator has the go-ahead, with the Reel posted on their own Instagram account. */
export async function postedReel(world: HeldWorld, options: { goAhead?: boolean; onInstagram?: Parameters<HeldWorld["instagram"]["hasPost"]>[2] | false } = {}) {
  const reel = await checkedReel(world);
  expect((await reel.maya.send("POST", `/brand/deals/${reel.deal.id}/deliverables/${reel.post}/approve`)).status).toBe(200);
  if (options.goAhead !== false) expect((await reel.sam.send("POST", `/deliverables/${reel.post}/go-ahead`)).status).toBe(200);
  const media = options.onInstagram === false ? undefined : world.instagram.hasPost("ig-sam", CODE, { caption: CAPTION, ...options.onInstagram });
  world.instagram.reads.length = 0;
  const read = async (browser: Browser, path: string) => (await (await browser.send("GET", path)).json()) as Record<string, unknown>;
  return {
    ...reel,
    media,
    /** "I've posted it". `null` sends no link at all. */
    posted: (url: unknown = LINK, browser = reel.sam) => browser.send("POST", `/deliverables/${reel.post}/posted`, { body: url === null ? {} : { url } }),
    again: () => reel.sam.send("POST", `/deliverables/${reel.post}/live-check/again`),
    money: async () => (await world.money.view(reel.post))!,
    recorded: () => prisma.postVideo.findUnique({ where: { deliverableId: reel.post } }),
    check: () => prisma.liveCheck.findUnique({ where: { deliverableId: reel.post } }),
    results: () => prisma.liveCheckItem.findMany({ where: { deliverableId: reel.post }, orderBy: { position: "asc" } }),
    creatorReads: () => read(reel.sam, `/deliverables/${reel.post}`),
    brandReads: () => read(reel.maya, `/brand/deals/${reel.deal.id}/deliverables/${reel.post}`),
    /** The fetched videos in the bucket now, and every one that was ever there. */
    fetched: () => ({ kept: [...world.storage.files.keys()].filter((key) => key.startsWith("live/")), ever: world.storage.everStored.filter((key) => key.startsWith("live/")) }),
  };
}

/** The Reel is posted and its link given at noon: its live check is waiting to run. */
export async function liveReel(world: HeldWorld, options: Parameters<typeof postedReel>[1] = {}) {
  const reel = await postedReel(world, options);
  world.timeIs("2026-10-09T12:00:00Z");
  expect((await reel.posted()).status).toBe(200);
  return reel;
}

/** Lets a live check run as the worker would over the next minute or so: a pass, a quarter of a minute, and again. */
export async function overAMinute(world: HeldWorld, passes = 5) {
  for (let pass = 0; pass < passes; pass++) {
    await world.runJobs();
    world.timeIs(new Date(world.now().getTime() + 15_000).toISOString());
  }
}
