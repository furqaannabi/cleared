/**
 * A world for tests of the draft check and review: the whole app over stand-ins for PayPal, the brief
 * model, storage and media, and a quick way to a post whose hold is in place. Everything before the
 * hold goes through the real routes, as a creator and a brand would.
 */
import { expect } from "bun:test";
import { createAccounts } from "../src/accounts/accounts";
import { createApp } from "../src/app";
import type { ModelReply } from "../src/briefs/reader";
import { prisma } from "../src/db";
import { createDeals } from "../src/deals/deals";
import { createDrafts, defaultDraftSettings, type DraftSettings } from "../src/drafts/drafts";
import { localLinkKeys } from "../src/invites/link-keys";
import { runDueJobs } from "../src/jobs/jobs";
import { createMoney } from "../src/money/money";
import { recordedPosts } from "../src/money/published-post";
import { createSessions } from "../src/sessions/sessions";
import { browserFor, type Browser } from "./browser";
import { FakeMedia } from "./fake-media";
import { FakePayPal } from "./fake-paypal";
import { FakeStorage } from "./fake-storage";

export const APP = "https://app.cleared.test";
const at = (iso: string) => new Date(iso);

/** Empties every table a deal touches. */
export async function resetDatabase() {
  await prisma.draftUsage.deleteMany();
  await prisma.draftCheck.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.moneyRecord.deleteMany();
  await prisma.payPalCall.deleteMany();
  await prisma.deliverableMoney.deleteMany();
  await prisma.briefRead.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.session.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.job.deleteMany();
}

/** The brief every deal here is made from, and the checklist the stand-in model reads out of it. */
export const brief = [
  "Hi Sam, thanks for doing this!",
  "Say the code GLOW20 out loud.",
  "Show yourself using the serum.",
  "Put the link https://glow.example/sam in the description.",
];
const checklist: ModelReply = {
  ok: true,
  answer: {
    items: [
      { line: 2, name: "Say the code GLOW20", kind: "said", appliesTo: "all", exact: "GLOW20" },
      { line: 3, name: "Show the serum in use", kind: "shown", appliesTo: "all" },
      { line: 4, name: "Put the link in the description", kind: "written", appliesTo: "all", exact: "https://glow.example/sam" },
    ],
    questions: [],
  },
};

interface Deal {
  id: string;
  deliverables: { id: string }[];
  items: { id: string; name: string; deliverableId: string }[];
}

export function heldWorld(options: { drafts?: Partial<DraftSettings> } = {}) {
  let now = at("2026-10-09T09:00:00Z");
  const clock = () => now;
  const paypal = new FakePayPal();
  const storage = new FakeStorage();
  const media = new FakeMedia();
  const money = createMoney({ prisma, paypal, posts: recordedPosts(prisma), now: clock });
  const deals = createDeals({ prisma, now: clock, model: { read: async () => checklist } });
  const accounts = createAccounts({ prisma, now: clock });
  const drafts = createDrafts({ prisma, now: clock, storage, media, money, settings: { ...defaultDraftSettings, ...options.drafts } });
  const app = createApp({
    prisma,
    appOrigin: APP,
    now: clock,
    deals,
    money,
    drafts,
    paypalClientId: "sandbox-public-client-id",
    linkKeys: localLinkKeys(Buffer.alloc(32, 1).toString("base64")),
  });
  const json = async <Body>(response: Response) => (await response.json()) as Body;

  /** A browser signed in as a creator with YouTube connected and a PayPal email saved. */
  async function creator(name = "Sam Rivera") {
    const browser = browserFor(app, APP);
    const first = name.split(" ")[0]!.toLowerCase();
    const { creatorId } = await accounts.signInWithGoogle({ googleId: `google-${name}`, name, email: `${first}@example.com` });
    await accounts.connectYouTube(creatorId, { externalId: `channel-${first}`, name, refreshTokenEncrypted: "sealed" });
    await accounts.setPaypalEmail(creatorId, `${first}.pay@example.com`);
    browser.cookies.set("cleared_session", await createSessions({ prisma, now: clock }).start(creatorId));
    return browser;
  }

  /** A browser signed in to a fresh demo account, as "Try the demo account" does. */
  async function demo() {
    const browser = browserFor(app, APP);
    await browser.send("POST", "/auth/demo", { form: true });
    return browser;
  }

  /**
   * A deal this creator and a brand have agreed, with a hold in place on every post, or on none if
   * `held` is false. Returns both browsers, the deal and its posts' ids.
   */
  async function agreedDeal(sam: Browser, deal: { platforms?: string[]; held?: boolean } = {}) {
    const platforms = deal.platforms ?? ["youtube_video"];
    const started = await json<Deal>(
      await sam.send("POST", "/deals", { body: { brandName: "Glow Skincare", deliverables: platforms.map((platform) => ({ platform })) } }),
    );
    await sam.send("POST", `/deals/${started.id}/brief`, { body: { text: brief.join("\n") } });
    await runDueJobs(prisma, deals.handlers, { now, log: () => {} });
    await sam.send("POST", `/deals/${started.id}/checklist/ready`);
    for (const post of started.deliverables) {
      await sam.send("PATCH", `/deals/${started.id}/invite/posts/${post.id}`, { body: { amount: "1200.00", deadlineDays: 14 } });
    }
    const invite = await json<{ link: { url: string } }>(
      await sam.send("POST", `/deals/${started.id}/invite/link`, { body: { timezone: "America/New_York" } }),
    );
    const maya = browserFor(app, APP);
    await maya.send("POST", `/b/${invite.link.url.split("/b/")[1]}/session`);
    expect((await maya.send("POST", `/brand/deals/${started.id}/agree`, { body: { version: 1 } })).status).toBe(200);
    const posts = started.deliverables.map((post) => post.id);
    if (deal.held !== false) {
      for (const post of posts) {
        const hold = `/brand/deals/${started.id}/posts/${post}/hold`;
        const { orderId } = await json<{ orderId: string }>(await maya.send("POST", hold));
        paypal.brandApproves(orderId);
        expect((await maya.send("POST", `${hold}/approved`, { body: { orderId } })).status).toBe(200);
      }
    }
    const read = await json<Deal>(await sam.send("GET", `/deals/${started.id}`));
    return { sam, maya, deal: read, posts, post: posts[0]! };
  }

  return {
    app,
    paypal,
    storage,
    media,
    money,
    creator,
    demo,
    agreedDeal,
    /** A browser nobody has signed in to. */
    visitor: () => browserFor(app, APP),
    /** One creator, one brand and one held post: the usual start of a draft check. */
    heldPost: async (deal: { platforms?: string[] } = {}) => agreedDeal(await creator(), deal),
    /** Runs every job that is due, as the service's worker would. */
    runJobs: () => runDueJobs(prisma, { ...deals.handlers, ...money.handlers, ...drafts.handlers }, { now, log: () => {} }),
    timeIs: (iso: string) => {
      now = at(iso);
    },
  };
}

export type HeldWorld = ReturnType<typeof heldWorld>;
