/** The brand's way in and its view of the deal, through the app (deal set-up spec DS-FR-33 to DS-FR-37). */
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

/** The stand-in model's answer: one item, and one question about a vague line. */
const answer: ModelReply = {
  ok: true,
  answer: {
    items: [{ line: 2, name: "Say the code GLOW20", kind: "said", appliesTo: "all", exact: "GLOW20" }],
    questions: [
      {
        line: 3,
        question: "Line 3 says 'mention us early'. How early?",
        suggestions: [
          { answer: "In the first 30 seconds", item: { name: "Mention Glow in the first 30 seconds", kind: "timing", appliesTo: "all" } },
          { answer: "In the first 60 seconds", item: { name: "Mention Glow in the first 60 seconds", kind: "timing", appliesTo: "all" } },
        ],
      },
    ],
  },
};
const brief = ["Hi Sam, thanks for doing this!", "Say the code GLOW20 out loud.", "Mention us early.", "Have fun with it."];

interface Deal {
  id: string;
  deliverables: { id: string }[];
  questions: { id: string }[];
  items: { id: string; name: string }[];
}

function setUp() {
  let now = at("2026-10-09T09:00:00Z");
  const clock = () => now;
  const deals = createDeals({ prisma, now: clock, model: { read: async () => answer } });
  const accounts = createAccounts({ prisma, now: clock });
  const app = createApp({ prisma, appOrigin: APP, now: clock, deals, linkKeys: localLinkKeys(Buffer.alloc(32, 1).toString("base64")) });
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

  return {
    creator,
    /** A browser nobody has signed in to: a brand's, before it opens its link. */
    visitor: () => browserFor(app, APP),
    /**
     * A deal of one YouTube video that its creator has sent to the brand: the vague line answered, an
     * item of the creator's own added, the terms set and the link made. Returns the deal and the link.
     */
    async sentDeal(browser: Browser, brandName = "Glow Skincare") {
      const started = await json<Deal>(await browser.send("POST", "/deals", { body: { brandName, deliverables: [{ platform: "youtube_video" }] } }));
      await browser.send("POST", `/deals/${started.id}/brief`, { body: { text: brief.join("\n") } });
      await runDueJobs(prisma, deals.handlers, { now, log: () => {} });
      const read = await json<Deal>(await browser.send("GET", `/deals/${started.id}`));
      await browser.send("PUT", `/deals/${started.id}/questions/${read.questions[0]!.id}`, { body: { kind: "suggestion", text: "In the first 30 seconds" } });
      await browser.send("POST", `/deals/${started.id}/items`, { body: { deliverableId: started.deliverables[0]!.id, name: "Wear the Glow cap", kind: "shown" } });
      await browser.send("POST", `/deals/${started.id}/checklist/ready`);
      await browser.send("PATCH", `/deals/${started.id}/invite/posts/${started.deliverables[0]!.id}`, { body: { amount: "1200.00", deadlineDays: 14 } });
      const invite = await json<{ link: { url: string } }>(
        await browser.send("POST", `/deals/${started.id}/invite/link`, { body: { timezone: "America/New_York" } }),
      );
      const deal = await json<Deal>(await browser.send("GET", `/deals/${started.id}`));
      return { deal, token: invite.link.url.split("/b/")[1]! };
    },
    timeIs: (iso: string) => {
      now = at(iso);
    },
  };
}

const open = (browser: Browser, token: string) => browser.send("POST", `/b/${token}/session`);
const brandDeal = (browser: Browser, dealId: string) => browser.send("GET", `/brand/deals/${dealId}`);
const sha256 = (text: string) => new Bun.CryptoHasher("sha256").update(text).digest("hex");

describe("DS-FR-34 swap the link for a session", () => {
  test("a live link's token opens its deal: the answer is the deal's id, and the deal can then be read", async () => {
    const world = setUp();
    const { deal, token } = await world.sentDeal(await world.creator());
    const maya = world.visitor();

    const response = await open(maya, token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dealId: deal.id });
    expect((await brandDeal(maya, deal.id)).status).toBe(200);
  });

  test("the session is a cookie the page cannot read, sent only to that deal's routes, until the link expires", async () => {
    const world = setUp();
    const { deal, token } = await world.sentDeal(await world.creator());
    world.timeIs("2026-10-10T09:00:00Z");

    const response = await open(world.visitor(), token);

    const [cookie, ...others] = response.headers.getSetCookie();
    expect(others).toEqual([]);
    const [pair, ...attributes] = cookie!.split("; ");
    expect(pair).toMatch(new RegExp(`^cleared_brand_${deal.id}=[A-Za-z0-9_-]{43}$`));
    expect(attributes.sort()).toEqual(["HttpOnly", `Max-Age=${6 * 24 * 60 * 60}`, `Path=/brand/deals/${deal.id}`, "SameSite=Lax", "Secure"]);
  });

  test("only a hash of the session's token is kept, and it is not in the answer", async () => {
    const world = setUp();
    const { token } = await world.sentDeal(await world.creator());
    const maya = world.visitor();

    const response = await open(maya, token);

    const [session] = [...maya.cookies.values()];
    expect(await response.text()).not.toContain(session!);
    const kept = await prisma.session.findMany({ where: { linkId: { not: null } } });
    expect(kept).toHaveLength(1);
    expect(kept[0]!.tokenHash).toBe(sha256(session!));
    expect(JSON.stringify(kept)).not.toContain(session!);
  });

  test("several people can each swap the same link, and each gets a session of their own", async () => {
    const world = setUp();
    const { deal, token } = await world.sentDeal(await world.creator());
    const maya = world.visitor();
    const colleague = world.visitor();

    await open(maya, token);
    await open(colleague, token);

    expect((await brandDeal(maya, deal.id)).status).toBe(200);
    expect((await brandDeal(colleague, deal.id)).status).toBe(200);
    expect([...colleague.cookies.values()]).not.toEqual([...maya.cookies.values()]);
  });

  test("the session lasts until the link's expiry and no longer", async () => {
    const world = setUp();
    const { deal, token } = await world.sentDeal(await world.creator());
    const maya = world.visitor();
    await open(maya, token);

    world.timeIs("2026-10-16T08:59:59Z");
    expect((await brandDeal(maya, deal.id)).status).toBe(200);
    world.timeIs("2026-10-16T09:00:00Z");
    expect((await brandDeal(maya, deal.id)).status).toBe(401);
  });

  test("a session opens the one deal its link was for, and no other", async () => {
    const world = setUp();
    const sam = await world.creator();
    const glow = await world.sentDeal(sam);
    const pine = await world.sentDeal(sam, "Pine Outdoors");
    const maya = world.visitor();
    await open(maya, glow.token);

    // Even if the browser were made to send Glow's session to Pine's routes.
    maya.cookies.set(`cleared_brand_${pine.deal.id}`, maya.cookies.get(`cleared_brand_${glow.deal.id}`)!);

    expect((await brandDeal(maya, pine.deal.id)).status).toBe(401);
    expect((await brandDeal(maya, glow.deal.id)).status).toBe(200);
  });

  test("a brand's session signs nobody in as a creator, and a creator's session is not a brand's", async () => {
    const world = setUp();
    const sam = await world.creator();
    const { deal, token } = await world.sentDeal(sam);
    const maya = world.visitor();
    await open(maya, token);

    maya.cookies.set("cleared_session", maya.cookies.get(`cleared_brand_${deal.id}`)!);
    expect((await maya.send("GET", "/deals")).status).toBe(401);
    expect((await maya.send("GET", `/deals/${deal.id}/invite`)).status).toBe(401);

    expect((await brandDeal(sam, deal.id)).status).toBe(401);
    sam.cookies.set(`cleared_brand_${deal.id}`, sam.cookies.get("cleared_session")!);
    expect((await brandDeal(sam, deal.id)).status).toBe(401);
  });
});

describe("DS-FR-35 a link that does not work", () => {
  test("an unknown, an expired and a turned-off link all get the same answer, which names no one and gives no reason", async () => {
    const world = setUp();
    const sam = await world.creator();
    const expired = await world.sentDeal(sam);
    const replaced = await world.sentDeal(sam, "Pine Outdoors");
    const changed = await world.sentDeal(sam, "Maple Moss");
    await sam.send("POST", `/deals/${replaced.deal.id}/invite/link/renew`);
    await sam.send("DELETE", `/deals/${changed.deal.id}/invite/link`);
    world.timeIs("2026-10-16T09:00:00Z");
    // The renewed link was made at 09:00 on the 9th too, so every one of these is past its 7 days or off.

    const answers = [];
    for (const token of ["never-a-link", "A".repeat(43), expired.token, replaced.token, changed.token]) {
      const visitor = world.visitor();
      const response = await open(visitor, token);
      expect(visitor.cookies.size).toBe(0);
      answers.push({ status: response.status, body: await response.text() });
    }

    expect(answers[0]).toEqual({ status: 404, body: JSON.stringify({ error: { code: "link_not_working" } }) });
    expect(new Set(answers.map((each) => JSON.stringify(each))).size).toBe(1);
  });
});

describe("DS-FR-33 a link turned off ends every session made from it", () => {
  test("making a new link ends the old link's sessions, and the new link opens the deal", async () => {
    const world = setUp();
    const sam = await world.creator();
    const { deal, token } = await world.sentDeal(sam);
    const maya = world.visitor();
    await open(maya, token);

    const renewed = (await (await sam.send("POST", `/deals/${deal.id}/invite/link/renew`)).json()) as { link: { url: string } };

    expect((await brandDeal(maya, deal.id)).status).toBe(401);
    expect(await prisma.session.count({ where: { linkId: { not: null } } })).toBe(0);
    expect((await open(maya, renewed.link.url.split("/b/")[1]!)).status).toBe(200);
    expect((await brandDeal(maya, deal.id)).status).toBe(200);
  });

  test("changing the terms ends them too", async () => {
    const world = setUp();
    const sam = await world.creator();
    const { deal, token } = await world.sentDeal(sam);
    const maya = world.visitor();
    await open(maya, token);

    await sam.send("DELETE", `/deals/${deal.id}/invite/link`);

    expect((await brandDeal(maya, deal.id)).status).toBe(401);
    expect(await prisma.session.count({ where: { linkId: { not: null } } })).toBe(0);
  });

  test("the creator's own session is left alone", async () => {
    const world = setUp();
    const sam = await world.creator();
    const { deal } = await world.sentDeal(sam);

    await sam.send("DELETE", `/deals/${deal.id}/invite/link`);

    expect((await sam.send("GET", "/deals")).status).toBe(200);
  });
});

describe("DS-FR-36 the brand's deal", () => {
  test("it shows who the deal is between, the terms, every item with where it came from, the brief and the version", async () => {
    const world = setUp();
    const { deal, token } = await world.sentDeal(await world.creator());
    const maya = world.visitor();
    await open(maya, token);
    const post = deal.deliverables[0]!.id;
    const item = (name: string) => deal.items.find((each) => each.name === name)!.id;

    const response = await brandDeal(maya, deal.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      dealId: deal.id,
      creatorName: "Sam Rivera",
      brandName: "Glow Skincare",
      step: "waiting_for_brand",
      version: 1,
      posts: [{ deliverableId: post, platform: "youtube_video", amount: "1200.00", deadlineDays: 14, hold: { state: "not_started" } }],
      items: [
        // From a line of the brief.
        { id: item("Say the code GLOW20"), deliverableId: post, name: "Say the code GLOW20", briefLine: 2, addedByCreator: false },
        // The creator's reading of an unclear line: it cites the line, and `answers` says how it was read.
        { id: item("Mention Glow in the first 30 seconds"), deliverableId: post, name: "Mention Glow in the first 30 seconds", briefLine: 3, addedByCreator: false },
        // Added by the creator: it cites no line.
        { id: item("Wear the Glow cap"), deliverableId: post, name: "Wear the Glow cap", addedByCreator: true },
      ],
      // The whole brief, so the page can show the lines no item cites (1 and 4 here).
      brief: brief.map((text, index) => ({ number: index + 1, text })),
      answers: [{ briefLine: 3, kind: "suggestion", text: "In the first 30 seconds" }],
      notes: [],
    });
  });

  test("it never carries the creator's PayPal email, their email or anything of the link", async () => {
    const world = setUp();
    const { deal, token } = await world.sentDeal(await world.creator());
    const maya = world.visitor();
    await open(maya, token);

    const body = await (await brandDeal(maya, deal.id)).text();

    expect(body).not.toContain("sam.pay@example.com");
    expect(body).not.toContain("sam@example.com");
    expect(body).not.toContain(token);
    expect(body).not.toContain("America/New_York");
  });
});

describe("DS-FR-37 no session", () => {
  test("a deal that exists and one that does not get the same answer: not signed in", async () => {
    const world = setUp();
    const { deal } = await world.sentDeal(await world.creator());
    const visitor = world.visitor();

    const real = await brandDeal(visitor, deal.id);
    const madeUp = await brandDeal(visitor, "00000000-0000-4000-8000-000000000000");

    expect(real.status).toBe(401);
    expect(await real.text()).toBe(JSON.stringify({ error: { code: "signed_out" } }));
    expect({ status: madeUp.status, body: await madeUp.text() }).toEqual({ status: 401, body: JSON.stringify({ error: { code: "signed_out" } }) });
  });
});
