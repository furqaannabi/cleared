/** The invite: terms, the brand's email and the brand's link, through the app (deal set-up spec DS-FR-29 to DS-FR-33). */
import { beforeEach, describe, expect, test } from "bun:test";
import { browserFor, type Browser } from "../test/browser";
import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import type { ModelReply } from "./briefs/reader";
import { prisma } from "./db";
import { createDeals } from "./deals/deals";
import { localLinkKeys } from "./invites/link-keys";
import { runDueJobs } from "./jobs/jobs";
import { createSessions } from "./sessions/sessions";

const APP = "https://app.cleared.test";
const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  await prisma.briefRead.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.session.deleteMany();
  await prisma.connectedAccount.deleteMany();
  await prisma.creator.deleteMany();
  await prisma.job.deleteMany();
});

/** The stand-in model's answer: one item for every post, and nothing to ask. */
const answer: ModelReply = {
  ok: true,
  answer: { items: [{ line: 2, name: "Say the code GLOW20", kind: "said", appliesTo: "all", exact: "GLOW20" }], questions: [] },
};
const brief = ["Hi Sam, thanks for doing this!", "Say the code GLOW20 out loud.", "Have fun with it."].join("\n");
const glow = { brandName: "Glow Skincare", deliverables: [{ platform: "youtube_video" }, { platform: "youtube_short" }] };

function setUp(options: { linkKey?: false } = {}) {
  let now = at("2026-10-09T09:00:00Z");
  const clock = () => now;
  const deals = createDeals({ prisma, now: clock, model: { read: async () => answer } });
  const accounts = createAccounts({ prisma, now: clock });
  const app = createApp({
    prisma,
    appOrigin: APP,
    now: clock,
    deals,
    linkKeys: options.linkKey === false ? undefined : localLinkKeys(Buffer.alloc(32, 1).toString("base64")),
  });

  /** A browser signed in as a creator. Unless told otherwise they have YouTube connected and a PayPal email saved. */
  async function creator(name = "Sam Rivera", has: { youtube?: boolean; paypalEmail?: boolean } = {}) {
    const browser = browserFor(app, APP);
    const first = name.split(" ")[0]!.toLowerCase();
    const { creatorId } = await accounts.signInWithGoogle({ googleId: `google-${name}`, name, email: `${first}@example.com` });
    if (has.youtube !== false) {
      await accounts.connectYouTube(creatorId, { externalId: `channel-${first}`, name, refreshTokenEncrypted: "sealed" });
    }
    if (has.paypalEmail !== false) await accounts.setPaypalEmail(creatorId, `${first}.pay@example.com`);
    browser.cookies.set("cleared_session", await createSessions({ prisma, now: clock }).start(creatorId));
    return browser;
  }

  return {
    creator,
    stranger: () => browserFor(app, APP),
    /** A deal of this creator's, with its checklist marked ready: at the invite step. */
    async dealAtInvite(browser: Browser) {
      const deal = (await (await browser.send("POST", "/deals", { body: glow })).json()) as Deal;
      await browser.send("POST", `/deals/${deal.id}/brief`, { body: { text: brief } });
      await runDueJobs(prisma, deals.handlers, { now, log: () => {} });
      const ready = await browser.send("POST", `/deals/${deal.id}/checklist/ready`);
      expect(ready.status).toBe(200);
      return deal;
    },
    startDeal: async (browser: Browser) => (await (await browser.send("POST", "/deals", { body: glow })).json()) as Deal,
    timeIs: (iso: string) => {
      now = at(iso);
    },
  };
}

interface Deal {
  id: string;
  deliverables: { id: string; platform: string }[];
}

interface Invite {
  dealId: string;
  brandName: string;
  step: string;
  posts: { deliverableId: string; platform: string; itemCount: number; amount?: string; deadlineDays?: number }[];
  brandEmail?: string;
  version?: number;
  link?: { url: string; expiresAt: string; expired: boolean };
}

const invitePath = (deal: Deal) => `/deals/${deal.id}/invite`;
const postPath = (deal: Deal, index = 0) => `${invitePath(deal)}/posts/${deal.deliverables[index]!.id}`;
const readInvite = async (browser: Browser, deal: Deal) => (await (await browser.send("GET", invitePath(deal))).json()) as Invite;
const setTerms = (browser: Browser, deal: Deal, terms: unknown, index = 0) => browser.send("PATCH", postPath(deal, index), { body: terms });

describe("DS-FR-29 the invite", () => {
  test("a deal at the invite step shows each post with how many items it has, and no terms yet", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);

    const response = await sam.send("GET", invitePath(deal));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      dealId: deal.id,
      brandName: "Glow Skincare",
      step: "invite",
      posts: [
        { deliverableId: deal.deliverables[0]!.id, platform: "youtube_video", itemCount: 1, cancel: { allowed: true } },
        { deliverableId: deal.deliverables[1]!.id, platform: "youtube_short", itemCount: 1, cancel: { allowed: true } },
      ],
    });
  });

  test("a deal still at the checklist step has no invite", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.startDeal(sam);

    const response = await sam.send("GET", invitePath(deal));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found" } });
  });
});

describe("DS-FR-29 terms", () => {
  test("the creator sets a post's amount and deadline, one at a time or together", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);

    const amount = await setTerms(sam, deal, { amount: "1200.00" });
    expect(amount.status).toBe(200);
    expect(((await amount.json()) as Invite).posts[0]).toMatchObject({ amount: "1200.00" });
    await setTerms(sam, deal, { deadlineDays: 14 });
    await setTerms(sam, deal, { amount: "300.50", deadlineDays: 7 }, 1);

    expect((await readInvite(sam, deal)).posts).toEqual([
      { deliverableId: deal.deliverables[0]!.id, platform: "youtube_video", itemCount: 1, amount: "1200.00", deadlineDays: 14, cancel: { allowed: true } },
      { deliverableId: deal.deliverables[1]!.id, platform: "youtube_short", itemCount: 1, amount: "300.50", deadlineDays: 7, cancel: { allowed: true } },
    ]);
  });

  test("an amount under $20.00 or over $10,000.00 is refused with the reason, and nothing is saved", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);
    await setTerms(sam, deal, { amount: "1200.00" });

    const low = await setTerms(sam, deal, { amount: "19.99" });
    const high = await setTerms(sam, deal, { amount: "10000.01", deadlineDays: 5 });

    expect(low.status).toBe(400);
    expect(await low.json()).toEqual({ error: { code: "amount_below_minimum", field: "amount" } });
    expect(high.status).toBe(400);
    expect(await high.json()).toEqual({ error: { code: "amount_above_maximum", field: "amount" } });
    expect((await readInvite(sam, deal)).posts[0]).toEqual({
      deliverableId: deal.deliverables[0]!.id,
      platform: "youtube_video",
      itemCount: 1,
      amount: "1200.00",
      cancel: { allowed: true },
    });
  });

  test("the least and the most one hold can be are both allowed", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);

    expect((await setTerms(sam, deal, { amount: "20.00" })).status).toBe(200);
    expect((await setTerms(sam, deal, { amount: "10000.00" }, 1)).status).toBe(200);
  });

  test("an amount that is not dollars with two places, and a deadline outside 1 to 21 days, are refused", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);

    for (const amount of ["1200", "1200.5", "-20.00", "1e3", 1200]) {
      const response = await setTerms(sam, deal, { amount });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: { code: "invalid", field: "amount" } });
    }
    for (const deadlineDays of [0, 22, 1.5, "14"]) {
      const response = await setTerms(sam, deal, { deadlineDays });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: { code: "invalid", field: "deadlineDays" } });
    }
    expect((await readInvite(sam, deal)).posts[0]).not.toHaveProperty("amount");
  });

  test("a post that is not one of the deal's is not found", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);
    const other = await world.dealAtInvite(sam);

    const response = await sam.send("PATCH", `${invitePath(deal)}/posts/${other.deliverables[0]!.id}`, { body: { amount: "50.00" } });

    expect(response.status).toBe(404);
    expect((await readInvite(sam, other)).posts[0]).not.toHaveProperty("amount");
  });
});

describe("DS-BR-01 an invite is its creator's alone", () => {
  test("another creator, and nobody signed in, can neither read it nor change it", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);
    const ada = await world.creator("Ada Okafor");

    expect((await ada.send("GET", invitePath(deal))).status).toBe(404);
    expect((await setTerms(ada, deal, { amount: "50.00" })).status).toBe(404);
    expect((await world.stranger().send("GET", invitePath(deal))).status).toBe(401);
    expect((await setTerms(world.stranger(), deal, { amount: "50.00" })).status).toBe(401);
    expect((await readInvite(sam, deal)).posts[0]).not.toHaveProperty("amount");
  });
});

const setBrandEmail = (browser: Browser, deal: Deal, brandEmail: unknown) => browser.send("PATCH", invitePath(deal), { body: { brandEmail } });

describe("DS-FR-30 the brand's email", () => {
  test("it is optional, kept when it is given and taken away again with null", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);

    const saved = await setBrandEmail(sam, deal, "maya@glow.example");
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as Invite).brandEmail).toBe("maya@glow.example");
    expect((await readInvite(sam, deal)).brandEmail).toBe("maya@glow.example");

    await setBrandEmail(sam, deal, null);
    expect(await readInvite(sam, deal)).not.toHaveProperty("brandEmail");
  });

  test("something that does not look like an email is refused", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);

    for (const brandEmail of ["maya", "maya@", "", 7, `${"m".repeat(250)}@glow.example`]) {
      const response = await setBrandEmail(sam, deal, brandEmail);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: { code: "invalid", field: "brandEmail" } });
    }
    expect(await readInvite(sam, deal)).not.toHaveProperty("brandEmail");
  });

  test("nothing is sent to it", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);
    await prisma.job.deleteMany();

    await setBrandEmail(sam, deal, "maya@glow.example");

    expect(await prisma.job.count()).toBe(0);
  });

  test("only the deal's creator can set it", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);

    expect((await setBrandEmail(await world.creator("Ada Okafor"), deal, "ada@evil.example")).status).toBe(404);
    expect((await setBrandEmail(world.stranger(), deal, "ada@evil.example")).status).toBe(401);
    expect(await readInvite(sam, deal)).not.toHaveProperty("brandEmail");
  });
});

const createLink = (browser: Browser, deal: Deal, body: unknown = { timezone: "America/New_York" }) =>
  browser.send("POST", `${invitePath(deal)}/link`, { body });
const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");

/** A deal at the invite step with every post's amount and deadline set. */
async function dealWithTerms(world: ReturnType<typeof setUp>, browser: Browser) {
  const deal = await world.dealAtInvite(browser);
  await setTerms(browser, deal, { amount: "1200.00", deadlineDays: 14 });
  await setTerms(browser, deal, { amount: "300.50", deadlineDays: 7 }, 1);
  return deal;
}

describe("DS-FR-31 create the link", () => {
  test("it makes a link to Cleared's app that expires in 7 days, saves version 1 and waits for the brand", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);

    const response = await createLink(sam, deal);

    expect(response.status).toBe(200);
    const invite = (await response.json()) as Invite;
    expect(invite).toMatchObject({
      step: "waiting_for_brand",
      version: 1,
      link: { url: expect.stringMatching(/^https:\/\/app\.cleared\.test\/b\/[A-Za-z0-9_-]{43}$/), expiresAt: "2026-10-16T09:00:00.000Z", expired: false },
    });
    expect(await prisma.termsVersion.findMany({ where: { dealId: deal.id } })).toMatchObject([
      {
        number: 1,
        terms: {
          posts: [
            { deliverableId: deal.deliverables[0]!.id, amountCents: 120_000, deadlineDays: 14 },
            { deliverableId: deal.deliverables[1]!.id, amountCents: 30_050, deadlineDays: 7 },
          ],
          items: [{ name: "Say the code GLOW20" }, { name: "Say the code GLOW20" }],
        },
      },
    ]);
  });

  test("it records the creator's timezone, which must be one that exists", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);

    for (const body of [{}, { timezone: "Mars/Olympus_Mons" }, { timezone: "" }, { timezone: 5 }]) {
      const response = await createLink(sam, deal, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: { code: "invalid", field: "timezone" } });
    }
    expect((await readInvite(sam, deal)).step).toBe("invite");

    await createLink(sam, deal, { timezone: "Asia/Kolkata" });
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).timezone).toBe("Asia/Kolkata");
  });

  test("it is refused while a post has no amount or no deadline", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await world.dealAtInvite(sam);
    await setTerms(sam, deal, { amount: "1200.00", deadlineDays: 14 });
    await setTerms(sam, deal, { amount: "300.50" }, 1);

    const response = await createLink(sam, deal);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "terms_incomplete", field: `posts.1` } });
    expect(await readInvite(sam, deal)).toMatchObject({ step: "invite" });
    expect(await prisma.inviteLink.count()).toBe(0);
  });

  test("it is refused until the creator's YouTube channel is connected", async () => {
    const world = setUp();
    const sam = await world.creator("Sam Rivera", { youtube: false });
    const deal = await dealWithTerms(world, sam);

    const response = await createLink(sam, deal);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "youtube_not_connected" } });
    expect(await prisma.inviteLink.count()).toBe(0);
  });

  test("it is refused until the creator's PayPal email is saved", async () => {
    const world = setUp();
    const sam = await world.creator("Sam Rivera", { paypalEmail: false });
    const deal = await dealWithTerms(world, sam);

    const response = await createLink(sam, deal);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "paypal_email_missing" } });
    expect(await prisma.inviteLink.count()).toBe(0);
  });

  test("a deal that already has its link does not get a second one this way", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    await createLink(sam, deal);

    const response = await createLink(sam, deal);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_at_invite" } });
    expect(await prisma.inviteLink.count()).toBe(1);
  });

  test("once the brand has the link, the terms, the brand's email and the checklist cannot be changed", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    await createLink(sam, deal);

    for (const response of [
      await setTerms(sam, deal, { amount: "5000.00" }),
      await setBrandEmail(sam, deal, "maya@glow.example"),
      await sam.send("POST", `/deals/${deal.id}/checklist/reopen`),
    ]) {
      expect(response.status).toBe(409);
    }
    expect((await readInvite(sam, deal)).posts[0]).toMatchObject({ amount: "1200.00" });
  });

  test("only the deal's creator can make its link", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);

    expect((await createLink(await world.creator("Ada Okafor"), deal)).status).toBe(404);
    expect((await createLink(world.stranger(), deal)).status).toBe(401);
    expect(await prisma.inviteLink.count()).toBe(0);
  });

  test("without the key that links are worked out from, no link is made", async () => {
    const world = setUp({ linkKey: false });
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);

    const response = await createLink(sam, deal);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "not_set_up" } });
    expect((await readInvite(sam, deal)).step).toBe("invite");
  });
});

describe("DS-FR-32 the link is returned to its creator only", () => {
  test("the creator's page can fetch the same link again while it is live", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    const made = ((await (await createLink(sam, deal)).json()) as Invite).link!;

    world.timeIs("2026-10-12T09:00:00Z");

    expect((await readInvite(sam, deal)).link).toEqual(made);
  });

  test("the database keeps a hash of the link's token and never the token", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    const { url } = ((await (await createLink(sam, deal)).json()) as Invite).link!;
    const token = url.split("/b/")[1]!;

    const [row] = await prisma.inviteLink.findMany();
    expect(row!.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(JSON.stringify(await prisma.deal.findMany())).not.toContain(token);
  });

  test("each link has its own token", async () => {
    const world = setUp();
    const sam = await world.creator();
    const first = ((await (await createLink(sam, await dealWithTerms(world, sam))).json()) as Invite).link!;
    const second = ((await (await createLink(sam, await dealWithTerms(world, sam))).json()) as Invite).link!;

    expect(second.url).not.toBe(first.url);
  });

  test("a link past its 7 days is reported as expired", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    await createLink(sam, deal);

    world.timeIs("2026-10-16T08:59:59Z");
    expect((await readInvite(sam, deal)).link).toMatchObject({ expired: false });
    world.timeIs("2026-10-16T09:00:00Z");
    expect((await readInvite(sam, deal)).link).toMatchObject({ expired: true, expiresAt: "2026-10-16T09:00:00.000Z" });
  });
});

const renewLink = (browser: Browser, deal: Deal) => browser.send("POST", `${invitePath(deal)}/link/renew`);
const turnOffLink = (browser: Browser, deal: Deal) => browser.send("DELETE", `${invitePath(deal)}/link`);
/** Whether a link's token still opens anything, by the record the brand's way in will look it up in. */
async function isOn(url: string) {
  const link = await prisma.inviteLink.findUnique({ where: { tokenHash: sha256(url.split("/b/")[1]!) } });
  return link !== null && link.turnedOffAt === null;
}

describe("DS-FR-33 make a new link", () => {
  test("the old link is turned off and a new one is returned, with 7 days of its own and the same version", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    const old = ((await (await createLink(sam, deal)).json()) as Invite).link!;
    world.timeIs("2026-10-11T09:00:00Z");

    const response = await renewLink(sam, deal);

    expect(response.status).toBe(200);
    const invite = (await response.json()) as Invite;
    expect(invite).toMatchObject({ step: "waiting_for_brand", version: 1, link: { expiresAt: "2026-10-18T09:00:00.000Z", expired: false } });
    expect(invite.link!.url).not.toBe(old.url);
    expect(await isOn(old.url)).toBe(false);
    expect(await isOn(invite.link!.url)).toBe(true);
    expect((await readInvite(sam, deal)).link).toEqual(invite.link);
  });

  test("an expired link can be replaced", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    await createLink(sam, deal);
    world.timeIs("2026-10-20T09:00:00Z");

    const invite = (await (await renewLink(sam, deal)).json()) as Invite;

    expect(invite.link).toMatchObject({ expiresAt: "2026-10-27T09:00:00.000Z", expired: false });
  });

  test("there is nothing to replace before a link is made, and only the deal's creator can replace it", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);

    const early = await renewLink(sam, deal);
    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ error: { code: "no_link" } });

    const made = ((await (await createLink(sam, deal)).json()) as Invite).link!;
    expect((await renewLink(await world.creator("Ada Okafor"), deal)).status).toBe(404);
    expect((await renewLink(world.stranger(), deal)).status).toBe(401);
    expect(await isOn(made.url)).toBe(true);
  });
});

describe("DS-FR-33 change terms", () => {
  test("the link is turned off, the deal goes back to the invite step and the terms can be edited again", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    const old = ((await (await createLink(sam, deal)).json()) as Invite).link!;

    const response = await turnOffLink(sam, deal);

    expect(response.status).toBe(200);
    const invite = (await response.json()) as Invite;
    expect(invite.step).toBe("invite");
    expect(invite).not.toHaveProperty("link");
    expect(invite).not.toHaveProperty("version");
    expect(invite.posts[0]).toMatchObject({ amount: "1200.00", deadlineDays: 14 });
    expect(await isOn(old.url)).toBe(false);
    expect((await setTerms(sam, deal, { amount: "1500.00" })).status).toBe(200);
    expect((await sam.send("POST", `/deals/${deal.id}/checklist/reopen`)).status).toBe(200);
  });

  test("the next link is a new one, and carries the changed terms as version 2", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);
    const old = ((await (await createLink(sam, deal)).json()) as Invite).link!;
    await turnOffLink(sam, deal);
    await setTerms(sam, deal, { amount: "1500.00" });

    const invite = (await (await createLink(sam, deal)).json()) as Invite;

    expect(invite).toMatchObject({ step: "waiting_for_brand", version: 2 });
    expect(invite.link!.url).not.toBe(old.url);
    expect(await isOn(old.url)).toBe(false);
    expect(await prisma.termsVersion.findMany({ where: { dealId: deal.id }, orderBy: { number: "asc" } })).toMatchObject([
      { number: 1, terms: { posts: [{ amountCents: 120_000 }, { amountCents: 30_050 }] } },
      { number: 2, terms: { posts: [{ amountCents: 150_000 }, { amountCents: 30_050 }] } },
    ]);
  });

  test("there is nothing to turn off before a link is made, and only the deal's creator can turn it off", async () => {
    const world = setUp();
    const sam = await world.creator();
    const deal = await dealWithTerms(world, sam);

    const early = await turnOffLink(sam, deal);
    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ error: { code: "no_link" } });

    const made = ((await (await createLink(sam, deal)).json()) as Invite).link!;
    expect((await turnOffLink(await world.creator("Ada Okafor"), deal)).status).toBe(404);
    expect((await turnOffLink(world.stranger(), deal)).status).toBe(401);
    expect(await isOn(made.url)).toBe(true);
    expect((await readInvite(sam, deal)).step).toBe("waiting_for_brand");
  });
});
