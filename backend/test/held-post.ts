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
import { createPublishedPosts } from "../src/publish/published-posts";
import { createNotices } from "../src/publish/notices";
import { createPublishing } from "../src/publish/publishing";
import { createReviewLinks } from "../src/review/links";
import { createReview } from "../src/review/review";
import { localSecrets } from "../src/secrets/secrets";
import { createSessions } from "../src/sessions/sessions";
import { browserFor, type Browser } from "./browser";
import { FakeJudge, FakeSpeech, FakeVideoModel } from "./fake-checks";
import { FakeEmail } from "./fake-email";
import { FakeMedia } from "./fake-media";
import { FakePayPal } from "./fake-paypal";
import { FakeStorage } from "./fake-storage";
import { FakeYouTube } from "./fake-youtube";

export const APP = "https://app.cleared.test";
const at = (iso: string) => new Date(iso);

/** Empties every table a deal touches. */
export async function resetDatabase() {
  await prisma.brandNotice.deleteMany();
  await prisma.liveCheckItem.deleteMany();
  await prisma.liveCheck.deleteMany();
  await prisma.postVideo.deleteMany();
  await prisma.checkItem.deleteMany();
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

export function heldWorld(
  options: {
    drafts?: Partial<DraftSettings>;
    /** An item of the creator's own, added to every deal's first post. */
    ownItem?: string;
    /** What kind that item is. Left alone, something shown in the video. */
    ownItemKind?: "shown" | "written" | "disclosure" | "publication";
    /** Makes telling the money path that a draft is cleared fail, as a database error would. */
    clearingFails?: boolean;
  } = {},
) {
  let now = at("2026-10-09T09:00:00Z");
  const clock = () => now;
  const paypal = new FakePayPal();
  const storage = new FakeStorage();
  const media = new FakeMedia();
  const speech = new FakeSpeech();
  const judge = new FakeJudge();
  const videoModel = new FakeVideoModel();
  const youtube = new FakeYouTube();
  const email = new FakeEmail();
  const secrets = localSecrets(Buffer.alloc(32, 2).toString("base64"));
  /** What the service logged, to check nothing from a video is ever in it. */
  const logged: unknown[] = [];
  const money = createMoney({ prisma, paypal, posts: createPublishedPosts({ prisma, now: clock, youtube, secrets }), now: clock });
  const deals = createDeals({ prisma, now: clock, model: { read: async () => checklist } });
  const linkKeys = localLinkKeys(Buffer.alloc(32, 1).toString("base64"));
  const reviewLinks = createReviewLinks({ prisma, now: clock, appOrigin: APP, linkKeys, money });
  const drafts = createDrafts({
    prisma,
    now: clock,
    storage,
    media,
    money,
    links: reviewLinks,
    checks: { speech, judge, videoModel },
    settings: { ...defaultDraftSettings, ...options.drafts },
    log: (...parts) => void logged.push(parts),
  });
  const review = createReview({
    prisma,
    now: clock,
    links: reviewLinks,
    money: options.clearingFails
      ? {
          view: money.view,
          draftClearedIn: async () => {
            throw new Error("the money path could not record the cleared draft");
          },
        }
      : money,
  });
  const notices = createNotices({ prisma, now: clock, links: reviewLinks, email, log: (...parts) => void logged.push(parts) });
  const publishing = createPublishing({ prisma, now: clock, youtube, secrets, money, judge, notices, log: (...parts) => void logged.push(parts) });
  const accounts = createAccounts({ prisma, now: clock, onYouTubeConnected: publishing.youtubeConnected });
  const app = createApp({
    prisma,
    appOrigin: APP,
    now: clock,
    deals,
    money,
    drafts,
    review,
    reviewLinks,
    publishing,
    storage,
    paypalClientId: "sandbox-public-client-id",
    linkKeys,
  });
  const json = async <Body>(response: Response) => (await response.json()) as Body;

  /** A browser signed in as a creator with YouTube connected and a PayPal email saved. */
  async function creator(name = "Sam Rivera") {
    const browser = browserFor(app, APP);
    const first = name.split(" ")[0]!.toLowerCase();
    const { creatorId } = await accounts.signInWithGoogle({ googleId: `google-${name}`, name, email: `${first}@example.com` });
    // Their stored access to YouTube is `refresh-<first name>`, kept encrypted as the service keeps it.
    await accounts.connectYouTube(creatorId, { externalId: `channel-${first}`, name, refreshTokenEncrypted: await secrets.encrypt(`refresh-${first}`) });
    await accounts.setPaypalEmail(creatorId, `${first}.pay@example.com`);
    browser.cookies.set("cleared_session", await createSessions({ prisma, now: clock }).start(creatorId));
    return browser;
  }

  /** The creator connects YouTube again, as the route does once Google has sent them back: the same channel, with access that works. */
  async function reconnectYouTube(name: string) {
    const first = name.split(" ")[0]!.toLowerCase();
    const { creatorId } = await accounts.signInWithGoogle({ googleId: `google-${name}`, name, email: `${first}@example.com` });
    await accounts.connectYouTube(creatorId, { externalId: `channel-${first}`, name, refreshTokenEncrypted: await secrets.encrypt(`refresh-${first}`) });
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
  async function agreedDeal(
    sam: Browser,
    deal: {
      platforms?: string[];
      held?: boolean;
      /** The brand's address as the creator typed it at the invite. */
      brandEmail?: string;
      /** The brand's own address for notices, given when it agrees (PT-FR-22). */
      noticeEmail?: string;
      /** False stops once the brand has opened the link, before it agrees. */
      agreed?: boolean;
    } = {},
  ) {
    const platforms = deal.platforms ?? ["youtube_video"];
    const started = await json<Deal>(
      await sam.send("POST", "/deals", { body: { brandName: "Glow Skincare", deliverables: platforms.map((platform) => ({ platform })) } }),
    );
    await sam.send("POST", `/deals/${started.id}/brief`, { body: { text: brief.join("\n") } });
    await runDueJobs(prisma, deals.handlers, { now, log: () => {} });
    if (options.ownItem) {
      await sam.send("POST", `/deals/${started.id}/items`, { body: { deliverableId: started.deliverables[0]!.id, name: options.ownItem, kind: options.ownItemKind ?? "shown" } });
    }
    await sam.send("POST", `/deals/${started.id}/checklist/ready`);
    for (const post of started.deliverables) {
      await sam.send("PATCH", `/deals/${started.id}/invite/posts/${post.id}`, { body: { amount: "1200.00", deadlineDays: 14 } });
    }
    if (deal.brandEmail) await sam.send("PATCH", `/deals/${started.id}/invite`, { body: { brandEmail: deal.brandEmail } });
    const invite = await json<{ link: { url: string } }>(
      await sam.send("POST", `/deals/${started.id}/invite/link`, { body: { timezone: "America/New_York" } }),
    );
    const maya = browserFor(app, APP);
    await maya.send("POST", `/b/${invite.link.url.split("/b/")[1]}/session`);
    if (deal.agreed === false) return { sam, maya, deal: started, posts: started.deliverables.map((post) => post.id), post: started.deliverables[0]!.id };
    expect((await maya.send("POST", `/brand/deals/${started.id}/agree`, { body: { version: 1, ...(deal.noticeEmail ? { email: deal.noticeEmail } : {}) } })).status).toBe(200);
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

  const runJobs = () => runDueJobs(prisma, { ...deals.handlers, ...money.handlers, ...drafts.handlers, ...review.handlers, ...publishing.handlers, ...notices.handlers }, { now, log: () => {} });

  return {
    app,
    paypal,
    storage,
    media,
    speech,
    judge,
    videoModel,
    youtube,
    email,
    logged,
    money,
    creator,
    reconnectYouTube,
    demo,
    agreedDeal,
    /** A browser nobody has signed in to. */
    visitor: () => browserFor(app, APP),
    /** One creator, one brand and one held post: the usual start of a draft check. */
    heldPost: async (deal: Parameters<typeof agreedDeal>[1] = {}) => agreedDeal(await creator(), deal),
    /** Runs every job that is due, as the service's worker would. */
    runJobs,
    /**
     * Lets every running check finish, as time passing would: the worker runs, a quarter of a minute
     * goes by, and so on until no check is waiting. The clock ends up a few minutes later at most.
     */
    async finishChecks() {
      for (let pass = 0; pass < 40; pass++) {
        await runJobs();
        if ((await prisma.job.count({ where: { name: "check_draft", status: "pending" } })) === 0) return;
        now = new Date(now.getTime() + 15_000);
      }
      throw new Error("A check was still running after ten minutes");
    },
    now: () => now,
    timeIs: (iso: string) => {
      now = at(iso);
    },
  };
}

export type HeldWorld = ReturnType<typeof heldWorld>;
