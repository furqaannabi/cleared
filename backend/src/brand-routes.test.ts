/** The brand's way in, its view of the deal, and asking for changes, through the app (deal set-up spec DS-FR-33 to DS-FR-42). */
import { beforeEach, describe, expect, test } from "bun:test";
import { browserFor, type Browser } from "../test/browser";
import { FakePayPal } from "../test/fake-paypal";
import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import type { ModelReply } from "./briefs/reader";
import { prisma } from "./db";
import { createDeals } from "./deals/deals";
import { localLinkKeys } from "./invites/link-keys";
import { runDueJobs } from "./jobs/jobs";
import { createMoney } from "./money/money";
import { recordedPosts } from "./money/published-post";
import { createSessions } from "./sessions/sessions";

const APP = "https://app.cleared.test";
const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  await prisma.moneyRecord.deleteMany();
  await prisma.payPalCall.deleteMany();
  await prisma.deliverableMoney.deleteMany();
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

function setUp(options: { money?: false } = {}) {
  let now = at("2026-10-09T09:00:00Z");
  const clock = () => now;
  const deals = createDeals({ prisma, now: clock, model: { read: async () => answer } });
  const accounts = createAccounts({ prisma, now: clock });
  const paypal = new FakePayPal();
  const money = createMoney({ prisma, paypal, posts: recordedPosts(prisma), now: clock });
  const app = createApp({ prisma, appOrigin: APP, now: clock, deals, money: options.money === false ? undefined : money, linkKeys: localLinkKeys(Buffer.alloc(32, 1).toString("base64")) });
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
    money,
    paypal,
    /** A browser nobody has signed in to: a brand's, before it opens its link. */
    visitor: () => browserFor(app, APP),
    /**
     * A deal of one YouTube video that its creator has sent to the brand: the vague line answered, an
     * item of the creator's own added, the terms set and the link made. Returns the deal and the link.
     */
    async sentDeal(browser: Browser, brandName = "Glow Skincare", platforms = ["youtube_video"]) {
      const started = await json<Deal>(
        await browser.send("POST", "/deals", { body: { brandName, deliverables: platforms.map((platform) => ({ platform })) } }),
      );
      await browser.send("POST", `/deals/${started.id}/brief`, { body: { text: brief.join("\n") } });
      await runDueJobs(prisma, deals.handlers, { now, log: () => {} });
      const read = await json<Deal>(await browser.send("GET", `/deals/${started.id}`));
      await browser.send("PUT", `/deals/${started.id}/questions/${read.questions[0]!.id}`, { body: { kind: "suggestion", text: "In the first 30 seconds" } });
      await browser.send("POST", `/deals/${started.id}/items`, { body: { deliverableId: started.deliverables[0]!.id, name: "Wear the Glow cap", kind: "shown" } });
      await browser.send("POST", `/deals/${started.id}/checklist/ready`);
      await browser.send("PATCH", `/deals/${started.id}/invite/posts/${started.deliverables[0]!.id}`, { body: { amount: "1200.00", deadlineDays: 14 } });
      // Any further post is $300.50, due in 7 days.
      for (const post of started.deliverables.slice(1)) {
        await browser.send("PATCH", `/deals/${started.id}/invite/posts/${post.id}`, { body: { amount: "300.50", deadlineDays: 7 } });
      }
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

interface Note {
  id: string;
  about: { kind: string; itemId?: string; briefLine?: number; deliverableId?: string };
  text: string;
  reply?: string;
  version: number;
}
interface BrandView {
  step: string;
  version: number;
  posts: { deliverableId: string; amount: string; deadlineDays: number; changed?: string[] }[];
  items: { id: string; name: string; changed?: boolean }[];
  notes: Note[];
}
interface InviteView {
  step: string;
  version?: number;
  posts: { amount?: string; deadlineDays?: number }[];
  notes?: Note[];
  link?: { url: string; expiresAt: string; expired: boolean };
}

const sendNotes = (browser: Browser, dealId: string, notes: unknown) => browser.send("POST", `/brand/deals/${dealId}/notes`, { body: { notes } });
const readBrand = async (browser: Browser, dealId: string) => (await (await brandDeal(browser, dealId)).json()) as BrandView;
const readInvite = async (browser: Browser, dealId: string) => (await (await browser.send("GET", `/deals/${dealId}/invite`)).json()) as InviteView;
const itemNamed = (deal: Deal, name: string) => deal.items.find((each) => each.name === name)!.id;

/** A sent deal with its creator's browser and a brand's browser that has opened the link. */
async function opened(world: ReturnType<typeof setUp>) {
  const sam = await world.creator();
  const { deal, token } = await world.sentDeal(sam);
  const maya = world.visitor();
  await open(maya, token);
  return { sam, maya, deal, token, post: deal.deliverables[0]!.id };
}

describe("DS-FR-38 the brand's notes", () => {
  test("a set of notes is sent together, each about an item, a brief line, an amount, a deadline or the whole deal", async () => {
    const world = setUp();
    const { sam, maya, deal, post } = await opened(world);
    const code = itemNamed(deal, "Say the code GLOW20");

    const response = await sendNotes(maya, deal.id, [
      { about: { kind: "item", itemId: code }, text: "  The code is GLOW25 now.  " },
      { about: { kind: "line", briefLine: 4 }, text: "Please add a line about cruelty-free." },
      { about: { kind: "amount", deliverableId: post }, text: "We said $1,000." },
      { about: { kind: "deadline", deliverableId: post }, text: "Can it be 10 days?" },
      { about: { kind: "deal" }, text: "Thanks Sam!" },
    ]);

    expect(response.status).toBe(200);
    const notes = [
      { id: expect.any(String), about: { kind: "item", itemId: code }, text: "The code is GLOW25 now.", version: 1 },
      { id: expect.any(String), about: { kind: "line", briefLine: 4 }, text: "Please add a line about cruelty-free.", version: 1 },
      { id: expect.any(String), about: { kind: "amount", deliverableId: post }, text: "We said $1,000.", version: 1 },
      { id: expect.any(String), about: { kind: "deadline", deliverableId: post }, text: "Can it be 10 days?", version: 1 },
      { id: expect.any(String), about: { kind: "deal" }, text: "Thanks Sam!", version: 1 },
    ];
    expect(await response.json()).toMatchObject({ step: "changes_requested", version: 1, notes });
    // The creator sees them on the invite and on the checklist.
    expect(await readInvite(sam, deal.id)).toMatchObject({ step: "changes_requested", notes });
    expect(await (await sam.send("GET", `/deals/${deal.id}`)).json()).toMatchObject({ step: "changes_requested", notes });
  });

  test("a note about something that is not in this deal, an empty one and one over 500 characters are refused, and none is kept", async () => {
    const world = setUp();
    const { sam, maya, deal, post } = await opened(world);
    const other = await world.sentDeal(sam, "Pine Outdoors");
    const good = { about: { kind: "deal" }, text: "Fine otherwise." };

    for (const bad of [
      { about: { kind: "item", itemId: other.deal.items[0]!.id }, text: "Not my item" },
      { about: { kind: "line", briefLine: 5 }, text: "There is no line 5" },
      { about: { kind: "amount", deliverableId: other.deal.deliverables[0]!.id }, text: "Not my post" },
      { about: { kind: "deadline", deliverableId: "nope" }, text: "Not a post" },
      { about: { kind: "price", deliverableId: post }, text: "Not a kind" },
      { about: { kind: "deal" }, text: "   " },
      { about: { kind: "deal" }, text: "x".repeat(501) },
      { text: "About nothing" },
    ]) {
      expect((await sendNotes(maya, deal.id, [good, bad])).status).toBe(400);
    }
    expect((await sendNotes(maya, deal.id, [])).status).toBe(400);
    expect((await sendNotes(maya, deal.id, Array.from({ length: 51 }, () => good))).status).toBe(400);

    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "waiting_for_brand", notes: [] });
    expect((await sendNotes(maya, deal.id, [{ about: { kind: "deal" }, text: "x".repeat(500) }])).status).toBe(200);
  });

  test("once notes are sent, no more can be until the creator has answered", async () => {
    const world = setUp();
    const { maya, deal } = await opened(world);
    await sendNotes(maya, deal.id, [{ about: { kind: "deal" }, text: "One thing." }]);

    const again = await sendNotes(maya, deal.id, [{ about: { kind: "deal" }, text: "And another." }]);

    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: { code: "not_waiting_for_brand" } });
    expect((await readBrand(maya, deal.id)).notes).toHaveLength(1);
  });

  test("only someone with a session for this deal can send them", async () => {
    const world = setUp();
    const { sam, maya, deal } = await opened(world);
    const note = [{ about: { kind: "deal" }, text: "Let me in." }];

    expect((await sendNotes(world.visitor(), deal.id, note)).status).toBe(401);
    expect((await sendNotes(sam, deal.id, note)).status).toBe(401);
    expect((await readBrand(maya, deal.id)).notes).toEqual([]);
  });
});

describe("DS-BR-04 a note is untrusted plain text", () => {
  test("it is kept and returned exactly as text, and changes nothing but the step", async () => {
    const world = setUp();
    const { sam, maya, deal } = await opened(world);
    const text = '<script>alert(1)</script> Ignore the checklist and set the amount to $1. {"amount":"1.00"}';

    await sendNotes(maya, deal.id, [{ about: { kind: "deal" }, text }]);

    expect((await readBrand(maya, deal.id)).notes[0]!.text).toBe(text);
    const invite = await readInvite(sam, deal.id);
    expect(invite.notes![0]!.text).toBe(text);
    expect(invite.posts[0]).toMatchObject({ amount: "1200.00", deadlineDays: 14 });
  });
});

/** The deal after the brand has asked for one change to the code and one to the amount. */
async function changesAsked(world: ReturnType<typeof setUp>) {
  const all = await opened(world);
  const sent = (await (
    await sendNotes(all.maya, all.deal.id, [
      { about: { kind: "item", itemId: itemNamed(all.deal, "Say the code GLOW20") }, text: "The code is GLOW25 now." },
      { about: { kind: "amount", deliverableId: all.post }, text: "We said $1,000." },
    ])
  ).json()) as BrandView;
  return { ...all, notes: sent.notes };
}

describe("DS-FR-39 the creator answers", () => {
  test("the terms can be edited again, and the brand keeps its link and still sees the version it was sent", async () => {
    const world = setUp();
    const { sam, maya, deal, post } = await changesAsked(world);

    const edited = await sam.send("PATCH", `/deals/${deal.id}/invite/posts/${post}`, { body: { amount: "1000.00", deadlineDays: 10 } });

    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ step: "changes_requested", posts: [{ amount: "1000.00", deadlineDays: 10 }], link: { expired: false } });
    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "changes_requested", version: 1, posts: [{ amount: "1200.00", deadlineDays: 14 }] });
  });

  test("the checklist can be edited again, and marking it ready comes back to the brand's changes, not to a new invite", async () => {
    const world = setUp();
    const { sam, maya, deal } = await changesAsked(world);
    const code = itemNamed(deal, "Say the code GLOW20");

    expect((await sam.send("POST", `/deals/${deal.id}/checklist/reopen`)).status).toBe(200);
    expect((await sam.send("PATCH", `/deals/${deal.id}/items/${code}`, { body: { name: "Say the code GLOW25" } })).status).toBe(200);
    // While the creator is on the checklist the brand's link is still on, and it still sees what it was sent.
    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "changes_requested", version: 1 });
    expect((await readBrand(maya, deal.id)).items.find((each) => each.id === code)!.name).toBe("Say the code GLOW20");
    // And the creator's list of deals says changes were asked, not that the checklist is unfinished.
    expect(await (await sam.send("GET", "/deals")).json()).toMatchObject([{ id: deal.id, step: "checklist", status: "Changes asked" }]);

    const ready = await sam.send("POST", `/deals/${deal.id}/checklist/ready`);

    expect(await ready.json()).toMatchObject({ step: "changes_requested" });
    expect(await readInvite(sam, deal.id)).toMatchObject({ step: "changes_requested", link: { expired: false } });
  });

  test("the creator can reply to each note, in plain text", async () => {
    const world = setUp();
    const { sam, maya, deal, notes } = await changesAsked(world);

    const response = await sam.send("PUT", `/deals/${deal.id}/notes/${notes[0]!.id}/reply`, { body: { reply: "  Done, it says GLOW25 now.  " } });

    expect(response.status).toBe(200);
    expect(((await response.json()) as InviteView).notes).toMatchObject([{ id: notes[0]!.id, reply: "Done, it says GLOW25 now." }, { id: notes[1]!.id }]);
    expect((await readBrand(maya, deal.id)).notes[0]).toMatchObject({ text: "The code is GLOW25 now.", reply: "Done, it says GLOW25 now." });
    expect((await readBrand(maya, deal.id)).notes[1]).not.toHaveProperty("reply");
  });

  test("an empty reply and one over 500 characters are refused, and so is a reply to a note that is not this deal's", async () => {
    const world = setUp();
    const { sam, deal, notes } = await changesAsked(world);
    const reply = (browser: Browser, dealId: string, noteId: string, text: unknown) =>
      browser.send("PUT", `/deals/${dealId}/notes/${noteId}/reply`, { body: { reply: text } });
    const pine = await world.sentDeal(sam, "Pine Outdoors");

    expect((await reply(sam, deal.id, notes[0]!.id, "   ")).status).toBe(400);
    expect((await reply(sam, deal.id, notes[0]!.id, "x".repeat(501))).status).toBe(400);
    expect((await reply(sam, deal.id, "no-such-note", "Hello")).status).toBe(404);
    expect((await reply(sam, pine.deal.id, notes[0]!.id, "Hello")).status).toBe(404);
    expect((await reply(await world.creator("Ada Okafor"), deal.id, notes[0]!.id, "Hello")).status).toBe(404);
    expect((await reply(world.visitor(), deal.id, notes[0]!.id, "Hello")).status).toBe(401);
    expect((await readInvite(sam, deal.id)).notes![0]).not.toHaveProperty("reply");
  });

  test("a link sent to the wrong person can still be replaced while changes are asked", async () => {
    const world = setUp();
    const { sam, maya, deal } = await changesAsked(world);

    const renewed = await sam.send("POST", `/deals/${deal.id}/invite/link/renew`);

    expect(renewed.status).toBe(200);
    expect(await renewed.json()).toMatchObject({ step: "changes_requested", version: 1 });
    expect((await brandDeal(maya, deal.id)).status).toBe(401);
  });
});

const sendUpdated = (browser: Browser, dealId: string) => browser.send("POST", `/deals/${dealId}/invite/send`);

describe("DS-FR-40 send updated terms", () => {
  test("a new version is saved, the deal waits for the brand again and the same link has 7 more days", async () => {
    const world = setUp();
    const { sam, deal, post } = await changesAsked(world);
    const before = (await readInvite(sam, deal.id)).link!;
    await sam.send("PATCH", `/deals/${deal.id}/invite/posts/${post}`, { body: { amount: "1000.00" } });
    world.timeIs("2026-10-12T09:00:00Z");

    const response = await sendUpdated(sam, deal.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      step: "waiting_for_brand",
      version: 2,
      link: { url: before.url, expiresAt: "2026-10-19T09:00:00.000Z", expired: false },
    });
    // The terms are the brand's to agree to again, so they are locked again.
    expect((await sam.send("PATCH", `/deals/${deal.id}/invite/posts/${post}`, { body: { amount: "900.00" } })).status).toBe(409);
  });

  test("the brand then sees the new version, what changed in it, and each note with its reply", async () => {
    const world = setUp();
    const { sam, maya, deal, post, notes } = await changesAsked(world);
    const code = itemNamed(deal, "Say the code GLOW20");
    await sam.send("PATCH", `/deals/${deal.id}/invite/posts/${post}`, { body: { amount: "1000.00" } });
    await sam.send("PUT", `/deals/${deal.id}/notes/${notes[1]!.id}/reply`, { body: { reply: "You're right, $1,000." } });
    await sam.send("POST", `/deals/${deal.id}/checklist/reopen`);
    await sam.send("PATCH", `/deals/${deal.id}/items/${code}`, { body: { name: "Say the code GLOW25" } });
    await sam.send("POST", `/deals/${deal.id}/items`, { body: { deliverableId: post, name: "Say it is cruelty-free", kind: "said" } });
    await sam.send("POST", `/deals/${deal.id}/checklist/ready`);

    await sendUpdated(sam, deal.id);

    const seen = await readBrand(maya, deal.id);
    expect(seen).toMatchObject({ step: "waiting_for_brand", version: 2 });
    expect(seen.posts).toMatchObject([{ amount: "1000.00", deadlineDays: 14, changed: ["amount"] }]);
    expect(seen.items.map((item) => ({ name: item.name, changed: item.changed }))).toEqual([
      { name: "Say the code GLOW25", changed: true },
      { name: "Mention Glow in the first 30 seconds", changed: undefined },
      { name: "Wear the Glow cap", changed: undefined },
      { name: "Say it is cruelty-free", changed: true },
    ]);
    expect(seen.notes).toMatchObject([
      { text: "The code is GLOW25 now.", version: 1 },
      { text: "We said $1,000.", reply: "You're right, $1,000.", version: 1 },
    ]);
  });

  test("the brand can ask for changes again, and those notes carry the new version", async () => {
    const world = setUp();
    const { sam, maya, deal } = await changesAsked(world);
    await sendUpdated(sam, deal.id);

    const again = await sendNotes(maya, deal.id, [{ about: { kind: "deal" }, text: "One more thing." }]);

    expect(again.status).toBe(200);
    expect(((await again.json()) as BrandView).notes.map((note) => note.version)).toEqual([1, 1, 2]);
  });

  test("a link that expired while the creator was answering works again once the terms are sent", async () => {
    const world = setUp();
    const { sam, maya, deal, token } = await changesAsked(world);
    world.timeIs("2026-10-20T09:00:00Z");
    expect((await brandDeal(maya, deal.id)).status).toBe(401);
    expect((await open(world.visitor(), token)).status).toBe(404);

    await sendUpdated(sam, deal.id);

    expect((await brandDeal(maya, deal.id)).status).toBe(200);
    expect((await open(world.visitor(), token)).status).toBe(200);
  });

  test("there is nothing to send unless the brand asked for changes, and only the deal's creator can send", async () => {
    const world = setUp();
    const { sam, deal } = await opened(world);

    const early = await sendUpdated(sam, deal.id);
    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ error: { code: "no_changes_asked" } });

    const asked = await changesAsked(world);
    expect((await sendUpdated(await world.creator("Ada Okafor"), asked.deal.id)).status).toBe(404);
    expect((await sendUpdated(world.visitor(), asked.deal.id)).status).toBe(401);
    expect(await readInvite(asked.sam, asked.deal.id)).toMatchObject({ step: "changes_requested", version: 1 });
  });

  test("it is refused while the creator is still on the checklist", async () => {
    const world = setUp();
    const { sam, maya, deal } = await changesAsked(world);
    await sam.send("POST", `/deals/${deal.id}/checklist/reopen`);

    expect((await sendUpdated(sam, deal.id)).status).toBe(404);
    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "changes_requested", version: 1 });
  });
});

const agree = (browser: Browser, dealId: string, version: unknown = 1) => browser.send("POST", `/brand/deals/${dealId}/agree`, { body: { version } });

describe("DS-FR-41 agree to a version", () => {
  test("the brand agrees by naming the version it was shown", async () => {
    const world = setUp();
    const { maya, deal } = await opened(world);
    world.timeIs("2026-10-10T15:30:00Z");

    const response = await agree(maya, deal.id, 1);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ step: "agreed", version: 1, agreedAt: "2026-10-10T15:30:00.000Z" });
    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "agreed", version: 1, agreedAt: "2026-10-10T15:30:00.000Z" });
  });

  test("a version that is not the latest is refused as out of date, and nothing changes", async () => {
    const world = setUp();
    const { sam, maya, deal, post } = await changesAsked(world);
    await sam.send("PATCH", `/deals/${deal.id}/invite/posts/${post}`, { body: { amount: "1000.00" } });
    await sendUpdated(sam, deal.id);

    // The brand's page still shows version 1; the creator has sent version 2.
    for (const version of [1, 3]) {
      const response = await agree(maya, deal.id, version);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: { code: "out_of_date" } });
    }
    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "waiting_for_brand", version: 2 });
    expect(await world.money.view(post)).toBeUndefined();

    expect((await agree(maya, deal.id, 2)).status).toBe(200);
    expect(await world.money.view(post)).toMatchObject({ amounts: { amount: "1000.00" } });
  });

  test("nothing can be agreed while the creator is answering the brand's changes", async () => {
    const world = setUp();
    const { maya, deal, post } = await changesAsked(world);

    const response = await agree(maya, deal.id, 1);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "not_waiting_for_brand" } });
    expect(await world.money.view(post)).toBeUndefined();
  });

  test("the version must be a whole number from 1, and only someone with a session for this deal can agree", async () => {
    const world = setUp();
    const { sam, maya, deal, post } = await opened(world);

    for (const version of [0, -1, 1.5, "1", null]) {
      const response = await agree(maya, deal.id, version);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: { code: "invalid", field: "version" } });
    }
    expect((await agree(world.visitor(), deal.id)).status).toBe(401);
    expect((await agree(sam, deal.id)).status).toBe(401);
    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "waiting_for_brand" });
    expect(await world.money.view(post)).toBeUndefined();
  });
});

describe("DS-FR-42 agreed", () => {
  /** A sent deal of a video and a Short, with the brand's browser in. */
  async function twoPosts(world: ReturnType<typeof setUp>) {
    const sam = await world.creator();
    const { deal, token } = await world.sentDeal(sam, "Glow Skincare", ["youtube_video", "youtube_short"]);
    const maya = world.visitor();
    await open(maya, token);
    return { sam, maya, deal, token, video: deal.deliverables[0]!.id, short: deal.deliverables[1]!.id };
  }

  test("each post's money is opened with its amount, its deadline, the creator's timezone and PayPal email", async () => {
    const world = setUp();
    const { maya, deal, video, short } = await twoPosts(world);
    world.timeIs("2026-10-10T15:30:00Z");

    await agree(maya, deal.id);

    expect(await world.money.creatorView(video)).toMatchObject({ stage: "not_held", amounts: { amount: "1200.00" }, hold: { state: "not_started" }, payoutEmail: "sam.pay@example.com" });
    expect(await world.money.creatorView(short)).toMatchObject({ stage: "not_held", amounts: { amount: "300.50" }, hold: { state: "not_started" }, payoutEmail: "sam.pay@example.com" });
    const opened = await prisma.deliverableMoney.findMany({ orderBy: { amountCents: "desc" } });
    expect(opened.map((each) => each.state)).toMatchObject([
      { amountCents: 120_000, deadlineDays: 14, creatorTimeZone: "America/New_York" },
      { amountCents: 30_050, deadlineDays: 7, creatorTimeZone: "America/New_York" },
    ]);
    // Each post now has 7 days to be held (MP-FR-08), and nothing has been asked of PayPal.
    expect((await prisma.job.findMany({ where: { name: "never_held" } })).map((job) => job.runAt)).toEqual([
      at("2026-10-17T15:30:00Z"),
      at("2026-10-17T15:30:00Z"),
    ]);
    expect(world.paypal.calls).toEqual([]);
  });

  test("a hold can be started for an agreed post, and not before", async () => {
    const world = setUp();
    const { maya, deal, video } = await twoPosts(world);
    expect(await world.money.startHold(video)).toMatchObject({ ok: false });

    await agree(maya, deal.id);

    expect(await world.money.startHold(video)).toMatchObject({ ok: true });
  });

  test("from then the terms and the checklist cannot be changed, no more notes are accepted, and it cannot be agreed again", async () => {
    const world = setUp();
    const { sam, maya, deal, video } = await twoPosts(world);
    await agree(maya, deal.id);

    for (const response of [
      await sam.send("PATCH", `/deals/${deal.id}/invite/posts/${video}`, { body: { amount: "5000.00" } }),
      await sam.send("PATCH", `/deals/${deal.id}/invite`, { body: { brandEmail: "maya@glow.example" } }),
      await sam.send("POST", `/deals/${deal.id}/checklist/reopen`),
      await sam.send("DELETE", `/deals/${deal.id}/invite/link`),
      await sendUpdated(sam, deal.id),
      await sendNotes(maya, deal.id, [{ about: { kind: "deal" }, text: "One more thing." }]),
    ]) {
      expect(response.status).toBe(409);
    }
    const again = await agree(maya, deal.id);
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: { code: "already_agreed" } });
    expect(await prisma.deliverableMoney.count()).toBe(2);
    expect(await readInvite(sam, deal.id)).toMatchObject({ step: "agreed", version: 1, posts: [{ amount: "1200.00" }, { amount: "300.50" }] });
    expect(await (await sam.send("GET", "/deals")).json()).toMatchObject([{ id: deal.id, step: "agreed", status: "Agreed" }]);
  });

  test("the brand keeps its way in after agreeing, to approve the holds", async () => {
    const world = setUp();
    const { maya, deal, token } = await twoPosts(world);

    await agree(maya, deal.id);

    expect((await brandDeal(maya, deal.id)).status).toBe(200);
    expect((await open(world.visitor(), token)).status).toBe(200);
  });

  test("two people agreeing at the same moment agree once, and each post's money is opened once", async () => {
    const world = setUp();
    const { maya, deal, token } = await twoPosts(world);
    const colleague = world.visitor();
    await open(colleague, token);

    const answers = await Promise.all([agree(maya, deal.id), agree(colleague, deal.id)]);

    expect(answers.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.deliverableMoney.count()).toBe(2);
    expect(await prisma.job.count({ where: { name: "never_held" } })).toBe(2);
  });

  test("it is all or nothing: if one post's money cannot be opened, the deal is not agreed and no post's money is", async () => {
    const world = setUp();
    const { maya, deal, video, short } = await twoPosts(world);
    // Something has already opened money under the second post's id, so opening it again must fail.
    await world.money.open({ deliverableId: short, amountCents: 5_000, deadlineDays: 3, creatorTimeZone: "UTC", payoutEmail: "someone@example.com" });

    const response = await agree(maya, deal.id);

    expect(response.status).toBe(500);
    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "waiting_for_brand" });
    expect(await world.money.view(video)).toBeUndefined();
    expect(await prisma.job.count({ where: { name: "never_held" } })).toBe(0);
  });

  test("a service with no PayPal set up agrees nothing, because it could not open the money", async () => {
    const world = setUp({ money: false });
    const { maya, deal } = await opened(world);

    const response = await agree(maya, deal.id);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "not_set_up" } });
    expect(await readBrand(maya, deal.id)).toMatchObject({ step: "waiting_for_brand" });
  });
});
