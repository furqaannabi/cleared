/** The creator's post at the draft check, through the app (draft check and review spec DR-FR-25 to DR-FR-29). */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { brief, heldWorld, resetDatabase } from "../test/held-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

const video = { bytes: new Uint8Array(2_000).fill(7) };
const sendDraft = (browser: Browser, post: string, name = "glow-draft.mp4") =>
  browser.send("POST", `/deliverables/${post}/draft?fileName=${name}`, { file: video });
const readPost = (browser: Browser, post: string) => browser.send("GET", `/deliverables/${post}`);

interface Item {
  id: string;
  name: string;
  kind: string;
  status: string;
  previousStatus?: string;
  briefLine?: { number: number; text: string };
  evidence?: { label: string; text: string; startSec: number; endSec: number };
  checkedBy: string;
  askable?: boolean;
  fixHint?: string;
}
interface Post {
  state: string;
  run: number;
  items: Item[];
  draft?: { fileName: string; durationSec: number; url: string; urlExpiresAt: string };
  checkFailure?: Record<string, unknown>;
  stages?: { name: string; status: string }[];
  [field: string]: unknown;
}
const post = async (browser: Browser, id: string) => (await (await readPost(browser, id)).json()) as Post;
const statuses = (read: Post) => read.items.map((item) => item.status);

describe("DR-FR-25 one post", () => {
  test("a held post with no draft yet: the checklist, the deadline, the hold and where the payout goes", async () => {
    const world = heldWorld();
    const { sam, post: id, deal } = await world.heldPost();
    const item = (name: string) => deal.items.find((each) => each.name === name)!.id;

    const response = await readPost(sam, id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id,
      brandName: "Glow Skincare",
      platform: "youtube_video",
      state: "no_draft",
      // 23:59 in New York, 14 days after the hold was approved on 9 October.
      deadline: "2026-10-24T03:59:00.000Z",
      creatorTimeZone: "America/New_York",
      run: 0,
      items: [
        { id: item("Say the code GLOW20"), name: "Say the code GLOW20", kind: "said", status: "not_checked", briefLine: { number: 2, text: brief[1] }, checkedBy: "exact_match" },
        { id: item("Show the serum in use"), name: "Show the serum in use", kind: "shown", status: "not_checked", briefLine: { number: 3, text: brief[2] }, checkedBy: "ai_timestamp" },
        { id: item("Put the link in the description"), name: "Put the link in the description", kind: "written", status: "at_live_check", briefLine: { number: 4, text: brief[3] }, checkedBy: "published_post" },
      ],
      brief: brief.map((text, index) => ({ number: index + 1, text })),
      hold: { amountMinor: 120_000, currency: "USD", reference: expect.any(String), heldAt: "2026-10-09T09:00:00.000Z", stage: "held" },
      payoutEmail: "sam.pay@example.com",
      cancel: { allowed: true },
    });
  });

  test("an item the creator added cites no line of the brief", async () => {
    const world = heldWorld({ ownItem: "Wear the Glow cap" });
    const { sam, post: id } = await world.heldPost();

    const cap = (await post(sam, id)).items.find((item) => item.name === "Wear the Glow cap")!;

    expect(cap).toEqual({ id: expect.any(String), name: "Wear the Glow cap", kind: "shown", status: "not_checked", checkedBy: "ai_timestamp" });
  });

  test("a finished run: every item's status, evidence and how it was checked, the run number and the latest draft", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    await sendDraft(sam, id);
    await world.finishChecks();

    const read = await post(sam, id);

    expect(read).toMatchObject({ state: "fully_passing", run: 1, draft: { fileName: "glow-draft.mp4", durationSec: 60 } });
    expect(read.items.map(({ status, evidence, checkedBy }) => ({ status, evidence, checkedBy }))).toEqual([
      { status: "passed", evidence: { label: "Transcript", text: "GLOW20", startSec: 40, endSec: 44 }, checkedBy: "exact_match" },
      { status: "passed", evidence: { label: "Video", text: "She applies the serum to her cheek.", startSec: 16, endSec: 20 }, checkedBy: "ai_timestamp" },
      { status: "at_live_check", evidence: undefined, checkedBy: "published_post" },
    ]);
    // The brand's 48 hours, from when the run finished.
    expect(read.reviewWindowEndsAt).toBe(new Date(world.now().getTime() + 48 * 60 * 60 * 1000).toISOString());
    expect(read).not.toHaveProperty("checkStartedAt");
    expect(read).not.toHaveProperty("stages");
  });

  test("an item that is not passed carries its suggestion, and an unsure one can be put to the brand", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    world.speech.speech = [{ text: "Use code GLOW2O at checkout.", startSec: 5, endSec: 8 }];
    world.videoModel.verdict = "fix_needed";
    await sendDraft(sam, id);
    await world.finishChecks();

    const read = await post(sam, id);

    expect(read.state).toBe("results");
    expect(read).not.toHaveProperty("reviewWindowEndsAt");
    expect(read.items.map(({ status, askable, fixHint }) => ({ status, askable, fixHint }))).toEqual([
      { status: "unsure", askable: true, fixHint: 'We heard "GLOW2O", not "GLOW20". If that is right, ask the brand to accept it. If not, say "GLOW20" clearly.' },
      { status: "fix_needed", askable: false, fixHint: "The bottle is on the desk but is never used." },
      { status: "at_live_check", askable: false, fixHint: undefined },
    ]);
  });

  test("from the second run each item says what it was in the run before", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    world.videoModel.verdict = "fix_needed";
    await sendDraft(sam, id);
    await world.finishChecks();
    expect((await post(sam, id)).items[0]).not.toHaveProperty("previousStatus");
    world.videoModel.verdict = "passed";
    await sendDraft(sam, id);
    await world.finishChecks();

    const read = await post(sam, id);

    expect(read.run).toBe(2);
    expect(read.items.map(({ status, previousStatus }) => [previousStatus, status])).toEqual([
      ["passed", "passed"],
      ["fix_needed", "passed"],
      ["at_live_check", "at_live_check"],
    ]);
  });

  test("only the post's own creator can read it, and a post with no hold yet has no page", async () => {
    const world = heldWorld();
    const { sam, maya, post: id } = await world.heldPost();
    const waiting = await world.agreedDeal(await world.creator("Ada Okafor"), { held: false });

    expect((await readPost(await world.creator("Mo Farouk"), id)).status).toBe(404);
    expect((await readPost(sam, "no-such-post")).status).toBe(404);
    expect((await readPost(maya, id)).status).toBe(401);
    expect((await readPost(world.visitor(), id)).status).toBe(401);

    const early = await readPost(waiting.sam, waiting.post);
    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ error: { code: "not_held" } });
  });
});

describe("DR-FR-26 while checking", () => {
  test("the post says when the check started and which stage it is at, and every draft-check item reads checking", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    world.speech.stillWorking = 5;
    await sendDraft(sam, id);

    const queued = await post(sam, id);
    expect(queued).toMatchObject({ state: "checking", run: 0, checkStartedAt: "2026-10-09T09:00:00.000Z" });
    expect(statuses(queued)).toEqual(["checking", "checking", "at_live_check"]);
    expect(queued.stages).toEqual([
      { name: "Reading the video", status: "current" },
      { name: "Checking what was said and written on screen", status: "waiting" },
      { name: "Checking what is shown", status: "waiting" },
      { name: "Confirming the evidence", status: "waiting" },
    ]);

    await world.runJobs();
    expect((await post(sam, id)).stages![0]).toEqual({ name: "Reading the video", status: "current" });
  });

  test("later stages show the ones before them as done", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    let during: Post | undefined;
    world.videoModel.whenAsked = async () => void (during = await post(sam, id));
    await sendDraft(sam, id);

    await world.finishChecks();

    expect(during!.stages!.map((stage) => stage.status)).toEqual(["done", "done", "current", "waiting"]);
    expect(statuses(during!)).toEqual(["checking", "checking", "at_live_check"]);
  });

  test("results appear together when the run finishes, never one by one", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    let during: Post | undefined;
    world.videoModel.whenAsked = async () => void (during = await post(sam, id));
    await sendDraft(sam, id);

    await world.finishChecks();

    // The code had already been matched when the video model was asked, and still read as checking.
    expect(during!.items[0]).toMatchObject({ name: "Say the code GLOW20", status: "checking" });
    expect(during!.items[0]).not.toHaveProperty("evidence");
    expect((await post(sam, id)).items[0]).toMatchObject({ status: "passed" });
  });
});

describe("DR-FR-27 the draft's address", () => {
  test("the latest draft comes with an address that plays it for 15 minutes, and a route gives a fresh one", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    await sendDraft(sam, id);
    const [draft] = await prisma.draft.findMany();

    const first = (await post(sam, id)).draft!;
    expect(first).toEqual({
      fileName: "glow-draft.mp4",
      durationSec: 60,
      url: `https://bucket.test/${draft!.storageKey}?good-for=900`,
      urlExpiresAt: "2026-10-09T09:15:00.000Z",
    });

    world.timeIs("2026-10-09T09:14:00Z");
    const fresh = await sam.send("POST", `/deliverables/${id}/draft-url`);

    expect(fresh.status).toBe(200);
    expect(await fresh.json()).toMatchObject({ fileName: "glow-draft.mp4", durationSec: 60, urlExpiresAt: "2026-10-09T09:29:00.000Z" });
  });

  test("a post with no draft has no address, and nobody else can ask for one", async () => {
    const world = heldWorld();
    const { sam, maya, post: id } = await world.heldPost();
    const fresh = (browser: Browser) => browser.send("POST", `/deliverables/${id}/draft-url`);

    const none = await fresh(sam);
    expect(none.status).toBe(404);
    expect(await none.json()).toEqual({ error: { code: "no_draft" } });
    expect(await post(sam, id)).not.toHaveProperty("draft");

    await sendDraft(sam, id);
    expect((await fresh(await world.creator("Ada Okafor"))).status).toBe(404);
    expect((await fresh(maya)).status).toBe(401);
    expect((await fresh(world.visitor())).status).toBe(401);
    // One address was given out so far: to the creator's own read of the file when it was sent.
    expect(world.storage.addresses).toHaveLength(1);
  });
});

describe("DR-FR-29 a check failure", () => {
  test("a failure on Cleared's side: the post says so, names the file, and the last results stay", async () => {
    const world = heldWorld({ drafts: { retries: 0 } });
    const { sam, post: id } = await world.heldPost();
    world.videoModel.verdict = "fix_needed";
    await sendDraft(sam, id, "first.mp4");
    await world.finishChecks();
    world.videoModel.down = true;
    await sendDraft(sam, id, "second.mp4");
    await world.finishChecks();

    const read = await post(sam, id);

    expect(read).toMatchObject({ state: "check_failed", run: 1, checkFailure: { kind: "ours", retrying: false, fileName: "second.mp4" } });
    expect(statuses(read)).toEqual(["passed", "fix_needed", "at_live_check"]);
  });

  test("while it is being tried again, the post is still checking and says a retry is under way", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    world.videoModel.down = true;
    await sendDraft(sam, id);
    await world.runJobs();
    world.timeIs("2026-10-09T09:00:10Z");
    await world.runJobs();

    expect(await post(sam, id)).toMatchObject({ state: "checking", checkFailure: { kind: "ours", retrying: true, fileName: "glow-draft.mp4" } });
  });

  test("a file that could not be checked is reported with its reason, its length and the cap", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    world.media.file = { format: "mp4", durationSec: 1000 };
    await sendDraft(sam, id, "too-long.mp4");

    expect(await post(sam, id)).toMatchObject({
      state: "check_failed",
      run: 0,
      checkFailure: { kind: "file", reason: "too_long", fileName: "too-long.mp4", lengthSec: 1000, lengthCapSec: 900 },
    });
  });

  test("a file failure after a finished run leaves that run's state and results as they were", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    await sendDraft(sam, id);
    await world.finishChecks();
    world.media.file = "unreadable";
    await sendDraft(sam, id, "broken.mp4");

    const read = await post(sam, id);

    expect(read).toMatchObject({ state: "fully_passing", run: 1, checkFailure: { kind: "file", reason: "unreadable", fileName: "broken.mp4" } });
    expect(statuses(read)).toEqual(["passed", "passed", "at_live_check"]);
    expect(read.draft).toMatchObject({ fileName: "glow-draft.mp4" });
  });
});

describe("DR-FR-43 a released post", () => {
  test("it reads released, with when and why, and its last results stay", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    await sendDraft(sam, id);
    await world.finishChecks();
    world.timeIs("2026-10-11T12:00:00Z");
    await world.money.cancel(id, "creator");

    const read = await post(sam, id);

    expect(read).toMatchObject({ state: "released", run: 1, releasedAt: "2026-10-11T12:00:00.000Z", releaseReason: "cancelled" });
    expect(statuses(read)).toEqual(["passed", "passed", "at_live_check"]);
    expect(read.items.every((item) => item.askable === false)).toBe(true);
  });
});

describe("DR-BR-13, DR-BR-18 what the post carries", () => {
  test("the creator sees their own PayPal email; nothing of the bucket's key or the link's token is in it", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();

    const body = await (await readPost(sam, id)).text();

    expect(body).toContain("sam.pay@example.com");
    expect(body).not.toContain("storageKey");
    expect(body).not.toContain("tokenHash");
  });
});

describe("DR-FR-28 the deals list", () => {
  const list = async (browser: Browser) => (await (await browser.send("GET", "/deals")).json()) as { status: string; openDeliverableId?: string; deliverables: { id: string; state: string }[] }[];

  test("each post has its real state, and the status follows the draft check", async () => {
    const world = heldWorld();
    const { sam, posts } = await world.heldPost({ platforms: ["youtube_video", "youtube_short"] });
    const [video, short] = posts as [string, string];
    expect(await list(sam)).toMatchObject([{ status: "Waiting for your draft", openDeliverableId: video, deliverables: [{ state: "no_draft" }, { state: "no_draft" }] }]);

    world.speech.stillWorking = 3;
    await sendDraft(sam, short);
    expect(await list(sam)).toMatchObject([{ status: "Draft check", deliverables: [{ id: video, state: "no_draft" }, { id: short, state: "checking" }] }]);

    await world.finishChecks();
    // The Short is with the brand now. The video still needs a draft, so it is the one to open.
    expect(await list(sam)).toMatchObject([{ status: "Draft check", openDeliverableId: video, deliverables: [{ state: "no_draft" }, { state: "fully_passing" }] }]);
  });

  test("when every post is with the brand the status says so, and a post that needs the creator is the one to open", async () => {
    const world = heldWorld();
    const { sam, posts } = await world.heldPost({ platforms: ["youtube_video", "youtube_short"] });
    const [video, short] = posts as [string, string];
    await sendDraft(sam, video);
    await sendDraft(sam, short);
    await world.finishChecks();
    expect(await list(sam)).toMatchObject([{ status: "Brand review", openDeliverableId: video, deliverables: [{ state: "fully_passing" }, { state: "fully_passing" }] }]);

    world.judge.visible = "no";
    await sendDraft(sam, short);
    await world.finishChecks();

    expect(await list(sam)).toMatchObject([{ status: "Draft check", openDeliverableId: short, deliverables: [{ state: "fully_passing" }, { state: "results" }] }]);
  });

  test("a deal whose posts are all released says so", async () => {
    const world = heldWorld();
    const { sam, post: id } = await world.heldPost();
    await world.money.cancel(id, "creator");

    expect(await list(sam)).toMatchObject([{ status: "Released", deliverables: [{ state: "released" }] }]);
  });
});
