/**
 * The check as a job: a draft sent through the app, read, checked and recorded, over stand-ins for the
 * three services (draft check and review spec DR-FR-10, DR-FR-21 to DR-FR-23, DR-BR-16, DR-BR-18, DR-BR-19).
 */
import { beforeEach, describe, expect, test } from "bun:test";
import type { Browser } from "../test/browser";
import { heldWorld, resetDatabase } from "../test/held-post";
import { prisma } from "./db";

beforeEach(resetDatabase);

const at = (iso: string) => new Date(iso);
const video = { bytes: new Uint8Array(2_000).fill(7) };
const sendDraft = (browser: Browser, post: string, name = "glow-draft.mp4") =>
  browser.send("POST", `/deliverables/${post}/draft?fileName=${name}`, { file: video });
const retry = (browser: Browser, post: string) => browser.send("POST", `/deliverables/${post}/check/retry`);
const check = (post: string) => prisma.draftCheck.findUniqueOrThrow({ where: { deliverableId: post } });
const items = async (post: string) =>
  (await prisma.checkItem.findMany({ where: { deliverableId: post }, orderBy: { position: "asc" } })).map((item) => ({
    result: item.result,
    checkedBy: item.checkedBy,
    evidence: item.evidence,
    hint: item.hint,
    previous: item.previous,
  }));
const checkJobs = () => prisma.job.findMany({ where: { name: "check_draft", status: "pending" } });

describe("DR-FR-10, DR-FR-21, DR-FR-22 a draft is checked and its run recorded", () => {
  test("a good draft: every item gets its result and evidence, the run is counted, and the review window opens", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    await sendDraft(sam, post);

    await world.finishChecks();

    expect(await check(post)).toMatchObject({ phase: "done", run: 1, stage: null, failures: 0 });
    expect(await items(post)).toEqual([
      { result: "passed", checkedBy: "exact_match", evidence: { label: "Transcript", text: "GLOW20", startSec: 40, endSec: 44 }, hint: null, previous: null },
      { result: "passed", checkedBy: "ai_timestamp", evidence: { label: "Video", text: "She applies the serum to her cheek.", startSec: 16, endSec: 20 }, hint: null, previous: null },
      { result: "at_live_check", checkedBy: "published_post", evidence: null, hint: null, previous: null },
    ]);
    // Fully passing, so the brand's 48 hours start when the run finishes, with their end written as a job.
    const finished = (await check(post)).windowOpenedAt!;
    expect((await check(post)).windowEndsAt).toEqual(new Date(finished.getTime() + 48 * 60 * 60 * 1000));
    expect(await prisma.job.findMany({ where: { name: "review_window_end" } })).toMatchObject([{ payload: { deliverableId: post }, runAt: (await check(post)).windowEndsAt }]);
  });

  test("the video is checked against the checklist the brand agreed to, and the video model is sent the stored file", async () => {
    const world = heldWorld();
    const { sam, post, deal } = await world.heldPost();
    await sendDraft(sam, post);

    await world.finishChecks();

    const [draft] = await prisma.draft.findMany();
    const serum = deal.items.find((item) => item.name === "Show the serum in use")!;
    expect(world.speech.started).toEqual([draft!.storageKey]);
    expect(world.videoModel.asked).toEqual([{ videoKey: draft!.storageKey, format: "mp4", durationSec: 60, items: [{ id: serum.id, name: "Show the serum in use" }] }]);
    expect(world.media.cut).toEqual([[16, 18, 20]]);
  });

  test("reading the video takes a while: the job starts it once, asks after it, and reports the stage meanwhile", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.speech.stillWorking = 3;
    await sendDraft(sam, post);

    await world.runJobs();
    expect(await check(post)).toMatchObject({ phase: "checking", stage: "reading" });
    expect(await checkJobs()).toMatchObject([{ runAt: at("2026-10-09T09:00:10Z") }]);
    expect(await prisma.checkItem.count()).toBe(0);

    await world.finishChecks();
    expect(world.speech.started).toHaveLength(1);
    expect(await check(post)).toMatchObject({ phase: "done", run: 1 });
  });

  test("the stage moves on as the check does", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    const seen: (string | null)[] = [];
    world.videoModel.whenAsked = async () => void seen.push((await check(post)).stage);
    await sendDraft(sam, post);

    await world.finishChecks();

    expect(seen).toEqual(["shown"]);
  });

  test("a draft that does not fully pass opens no window", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.videoModel.verdict = "fix_needed";
    world.speech.speech = [{ text: "Use code GLOW2O at checkout.", startSec: 5, endSec: 8 }];
    await sendDraft(sam, post);

    await world.finishChecks();

    expect(await check(post)).toMatchObject({ phase: "done", run: 1, windowOpenedAt: null, windowEndsAt: null });
    expect((await items(post)).map((item) => [item.result, item.hint])).toEqual([
      ["unsure", 'We heard "GLOW2O", not "GLOW20". If that is right, ask the brand to accept it. If not, say "GLOW20" clearly.'],
      ["fix_needed", "The bottle is on the desk but is never used."],
      ["at_live_check", null],
    ]);
    expect(await prisma.job.count({ where: { name: "review_window_end" } })).toBe(0);
  });

  test("a second look that does not agree leaves the shown item unsure, and the draft is not fully passing", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.judge.visible = "cannot_tell";
    await sendDraft(sam, post);

    await world.finishChecks();

    expect((await items(post)).map((item) => item.result)).toEqual(["passed", "unsure", "at_live_check"]);
    expect((await check(post)).windowEndsAt).toBeNull();
  });
});

describe("DR-FR-22, DR-BR-19 a second draft", () => {
  test("its run is the second, each item remembers what it was, and the first file is deleted when the second finishes", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.videoModel.verdict = "fix_needed";
    await sendDraft(sam, post, "first.mp4");
    await world.finishChecks();
    const [first] = await prisma.draft.findMany();

    world.videoModel.verdict = "passed";
    await sendDraft(sam, post, "second.mp4");
    // While the second is being checked the first is still there, and so are its results.
    expect(world.storage.files.has(first!.storageKey)).toBe(true);
    expect((await items(post)).map((item) => item.result)).toEqual(["passed", "fix_needed", "at_live_check"]);

    await world.finishChecks();

    expect(await check(post)).toMatchObject({ phase: "done", run: 2 });
    expect((await items(post)).map((item) => [item.result, item.previous])).toEqual([
      ["passed", "passed"],
      ["passed", "fix_needed"],
      ["at_live_check", "at_live_check"],
    ]);
    const drafts = await prisma.draft.findMany();
    expect(drafts.map((draft) => draft.fileName)).toEqual(["second.mp4"]);
    expect([...world.storage.files.keys()]).toEqual([drafts[0]!.storageKey]);
  });

  test("a new draft ends the window the draft before it had opened, at once", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    await sendDraft(sam, post);
    await world.finishChecks();
    expect((await check(post)).windowEndsAt).not.toBeNull();

    await sendDraft(sam, post);

    expect(await check(post)).toMatchObject({ phase: "checking", windowOpenedAt: null, windowEndsAt: null });
  });
});

describe("DR-FR-23 when a service fails", () => {
  test("nothing of the run is shown; the job waits and tries again, and a service that comes back finishes the run", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.videoModel.down = true;
    await sendDraft(sam, post);
    await world.runJobs();
    world.timeIs("2026-10-09T09:00:10Z");

    await world.runJobs();

    expect(await check(post)).toMatchObject({ phase: "checking", run: 0, failures: 1 });
    expect(await prisma.checkItem.count()).toBe(0);
    expect(await checkJobs()).toMatchObject([{ runAt: at("2026-10-09T09:00:40Z") }]);

    world.videoModel.down = false;
    await world.finishChecks();

    expect(await check(post)).toMatchObject({ phase: "done", run: 1, failures: 0 });
    // The video was read once: a retry does not pay for the reading again.
    expect(world.speech.started).toHaveLength(1);
  });

  test("the waits grow, and after three more tries the post reports a failure on Cleared's side", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.judge.down = true;
    world.videoModel.verdict = "passed";
    await sendDraft(sam, post);
    const waits: number[] = [];

    for (let pass = 0; pass < 12; pass++) {
      await world.runJobs();
      const [job] = await checkJobs();
      if (!job) break;
      if ((await check(post)).failures > waits.length) waits.push((job.runAt.getTime() - world.now().getTime()) / 1000);
      world.timeIs(job.runAt.toISOString());
    }

    expect(waits).toEqual([30, 60, 120]);
    expect(await check(post)).toMatchObject({ phase: "check_failed", run: 0, stage: null });
    expect(await prisma.checkItem.count()).toBe(0);
    expect(await checkJobs()).toEqual([]);
    expect(world.judge.asked.frames).toBe(4);
  });

  test("a failed check is not one of the post's checks, and the creator can start the same draft's check again", async () => {
    const world = heldWorld({ drafts: { retries: 0 } });
    const { sam, post } = await world.heldPost();
    world.videoModel.down = true;
    await sendDraft(sam, post);
    await world.finishChecks();
    expect(await check(post)).toMatchObject({ phase: "check_failed", run: 0 });
    world.videoModel.down = false;

    const response = await retry(sam, post);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deliverableId: post, state: "checking", run: 0 });
    await world.finishChecks();
    expect(await check(post)).toMatchObject({ phase: "done", run: 1 });
    // The same file, checked again: nothing was uploaded and nothing more was counted.
    expect(world.storage.everStored).toHaveLength(1);
    expect(await prisma.draftUsage.count()).toBe(1);
  });

  test("a reading that ends in failure is started afresh on the next try", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.speech.down = "reading";
    await sendDraft(sam, post);
    await world.runJobs();
    world.timeIs("2026-10-09T09:00:10Z");
    await world.runJobs();
    expect(await check(post)).toMatchObject({ failures: 1, speechJobId: null });

    world.speech.down = undefined;
    await world.finishChecks();

    expect(world.speech.started).toHaveLength(2);
    expect(await check(post)).toMatchObject({ phase: "done", run: 1 });
  });

  test("frames that cannot be cut fail the run like any other service", async () => {
    const world = heldWorld({ drafts: { retries: 0 } });
    const { sam, post } = await world.heldPost();
    world.media.broken = true;
    await sendDraft(sam, post);

    await world.finishChecks();

    expect(await check(post)).toMatchObject({ phase: "check_failed", run: 0 });
    expect(await prisma.checkItem.count()).toBe(0);
  });

  test("there is nothing to start again unless a check failed, and only the post's creator can", async () => {
    const world = heldWorld({ drafts: { retries: 0 } });
    const { sam, maya, post } = await world.heldPost();

    expect((await retry(sam, post)).status).toBe(409);
    await sendDraft(sam, post);
    expect(await (await retry(sam, post)).json()).toEqual({ error: { code: "no_failed_check" } });
    await world.finishChecks();
    expect((await retry(sam, post)).status).toBe(409);

    expect((await retry(await world.creator("Ada Okafor"), post)).status).toBe(404);
    expect((await retry(maya, post)).status).toBe(401);
    expect((await retry(world.visitor(), post)).status).toBe(401);
  });
});

describe("DR-BR-16 what counts towards the limits", () => {
  test("a draft's minutes count from the moment its video is sent to be read", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    await sendDraft(sam, post);
    expect(await prisma.draftUsage.findMany()).toMatchObject([{ seconds: 60, analysed: false }]);

    await world.runJobs();

    expect(await prisma.draftUsage.findMany()).toMatchObject([{ seconds: 60, analysed: true }]);
  });

  test("minutes already sent for reading still count when the check then fails", async () => {
    const world = heldWorld({ drafts: { retries: 0 } });
    const { sam, post } = await world.heldPost();
    world.videoModel.down = true;
    await sendDraft(sam, post);

    await world.finishChecks();

    expect(await prisma.draftUsage.findMany()).toMatchObject([{ analysed: true }]);
  });
});

describe("DR-FR-43 a hold released while a check runs", () => {
  test("the check stops: no result is recorded and no window opens", async () => {
    const world = heldWorld();
    const { sam, post } = await world.heldPost();
    world.speech.stillWorking = 2;
    await sendDraft(sam, post);
    await world.runJobs();
    await world.money.cancel(post, "creator");

    await world.finishChecks();

    expect(await prisma.checkItem.count()).toBe(0);
    expect(await check(post)).toMatchObject({ run: 0, windowEndsAt: null });
    expect(world.videoModel.asked).toEqual([]);
  });
});

describe("DR-BR-18 what is logged", () => {
  test("a failed check logs ids and counts, and nothing that was said or shown in the video", async () => {
    const world = heldWorld({ drafts: { retries: 0 } });
    const { sam, post } = await world.heldPost();
    world.speech.speech = [{ text: "My secret unreleased product is called Moonbeam.", startSec: 0, endSec: 4 }];
    world.videoModel.down = true;
    await sendDraft(sam, post, "moonbeam-launch.mp4");

    await world.finishChecks();

    const logged = JSON.stringify(world.logged);
    expect(world.logged).toHaveLength(1);
    expect(logged).toContain(post);
    expect(logged).not.toContain("Moonbeam");
    expect(logged).not.toContain("moonbeam-launch");
    expect(logged).not.toContain("bucket.test");
  });
});
