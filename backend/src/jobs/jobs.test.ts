import { beforeEach, describe, expect, test } from "bun:test";
import { prisma } from "../db";
import { defaultJobSettings, enqueue, runDueJobs, type JobHandlers, type NewJob } from "./jobs";

const at = (iso: string) => new Date(iso);

beforeEach(async () => {
  await prisma.job.deleteMany();
});

/** Writes jobs the way the money module does: inside a transaction. */
async function add(...jobs: NewJob[]) {
  await prisma.$transaction(async (tx) => {
    for (const job of jobs) await enqueue(tx, job);
  });
}

const deadlineJob = (runAt: string, deliverableId = "del_1"): NewJob => ({
  name: "deadline",
  payload: { deliverableId },
  runAt: at(runAt),
});

/** A handler set that records every run. */
function recording() {
  const runs: unknown[] = [];
  const handlers: JobHandlers = {
    deadline: async (payload) => {
      runs.push(payload);
    },
  };
  return { runs, handlers };
}

describe("MP-FR-42 jobs in Postgres", () => {
  test("a job is written with the change it belongs to, or not at all", async () => {
    await prisma.$transaction(async (tx) => {
      await enqueue(tx, { name: "deadline", payload: { deliverableId: "del_1" }, runAt: at("2026-10-24T22:59:00Z") });
    });
    await prisma
      .$transaction(async (tx) => {
        await enqueue(tx, { name: "day_28", payload: { deliverableId: "del_1" }, runAt: at("2026-11-07T09:05:10Z") });
        throw new Error("the money change failed");
      })
      .catch(() => {});

    const jobs = await prisma.job.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      name: "deadline",
      payload: { deliverableId: "del_1" },
      runAt: at("2026-10-24T22:59:00Z"),
      status: "pending",
    });
  });
});

describe("MP-FR-42 running due jobs", () => {
  test("a due job runs once and is marked done", async () => {
    const { runs, handlers } = recording();
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    await runDueJobs(prisma, handlers, { now: at("2026-10-24T22:59:00Z") });
    await runDueJobs(prisma, handlers, { now: at("2026-10-24T23:10:00Z") });

    expect(runs).toEqual([{ deliverableId: "del_1" }]);
    expect(await prisma.job.findMany()).toMatchObject([
      { status: "done", attempts: 1, failures: 0, finishedAt: at("2026-10-24T22:59:00Z") },
    ]);
  });

  test("a job that is not due yet does not run", async () => {
    const { runs, handlers } = recording();
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    await runDueJobs(prisma, handlers, { now: at("2026-10-24T22:58:59Z") });

    expect(runs).toEqual([]);
    expect(await prisma.job.findMany()).toMatchObject([{ status: "pending", attempts: 0 }]);
  });

  test("due jobs run in the order they fell due", async () => {
    const { runs, handlers } = recording();
    await add(deadlineJob("2026-10-24T22:59:00Z", "later"), deadlineJob("2026-10-20T22:59:00Z", "earlier"));

    await runDueJobs(prisma, handlers, { now: at("2026-10-25T00:00:00Z") });

    expect(runs).toEqual([{ deliverableId: "earlier" }, { deliverableId: "later" }]);
  });

  test("with two workers and one due job, the job runs once", async () => {
    const runs: unknown[] = [];
    const handlers: JobHandlers = {
      deadline: async (payload) => {
        runs.push(payload);
        // Long enough for the second worker to look for work while this one is still running.
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
    };
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    const now = at("2026-10-24T22:59:00Z");
    await Promise.all([runDueJobs(prisma, handlers, { now }), runDueJobs(prisma, handlers, { now })]);

    expect(runs).toHaveLength(1);
  });
});

describe("MP-FR-43 late, never lost", () => {
  const failing: JobHandlers = {
    deadline: async () => {
      throw new Error("PayPal is not answering");
    },
  };
  const quiet = { log: () => {} };

  test("a job that fails is tried again later, with a growing delay", async () => {
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:00Z"), ...quiet });
    expect(await prisma.job.findMany()).toMatchObject([
      { status: "pending", failures: 1, runAt: at("2026-10-24T23:00:00Z"), lastError: "PayPal is not answering" },
    ]);

    // Not before its new time.
    expect(await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:59Z"), ...quiet })).toBe(0);

    await runDueJobs(prisma, failing, { now: at("2026-10-24T23:00:00Z"), ...quiet });
    expect(await prisma.job.findMany()).toMatchObject([
      { status: "pending", failures: 2, runAt: at("2026-10-24T23:02:00Z") },
    ]);
  });

  test("the delay stops growing at the longest wait", async () => {
    const settings = { ...defaultJobSettings, firstRetrySeconds: 60, longestRetrySeconds: 150 };
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:00Z"), settings, ...quiet });
    await runDueJobs(prisma, failing, { now: at("2026-10-24T23:00:00Z"), settings, ...quiet });
    await runDueJobs(prisma, failing, { now: at("2026-10-24T23:02:00Z"), settings, ...quiet });

    // 60 seconds, then 120, then 150 instead of 240.
    expect(await prisma.job.findMany()).toMatchObject([{ failures: 3, runAt: at("2026-10-24T23:04:30Z") }]);
  });

  test("after the limit it is marked failed, logged without its payload, and never run again", async () => {
    const settings = { ...defaultJobSettings, maxFailures: 2 };
    const logged: unknown[] = [];
    const log = (...parts: unknown[]) => logged.push(parts);
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:00Z"), settings, log });
    await runDueJobs(prisma, failing, { now: at("2026-10-24T23:00:00Z"), settings, log });
    const ranAgain = await runDueJobs(prisma, failing, { now: at("2026-10-30T00:00:00Z"), settings, log });

    const [job] = await prisma.job.findMany();
    expect(job).toMatchObject({ status: "failed", failures: 2, finishedAt: at("2026-10-24T23:00:00Z") });
    expect(ranAgain).toBe(0);
    expect(logged).toHaveLength(1);
    expect(JSON.stringify(logged)).toContain(job!.id);
    expect(JSON.stringify(logged)).not.toContain("del_1");
  });

  test("a job nobody knows how to run counts as a failure", async () => {
    await add({ name: "no_such_job", payload: {}, runAt: at("2026-10-24T22:59:00Z") });

    await runDueJobs(prisma, {}, { now: at("2026-10-24T22:59:00Z"), ...quiet });

    expect(await prisma.job.findMany()).toMatchObject([
      { status: "pending", failures: 1, lastError: "No handler for job no_such_job" },
    ]);
  });

  test("one failing job does not stop the others", async () => {
    const runs: unknown[] = [];
    const handlers: JobHandlers = {
      ...failing,
      day_28: async (payload) => {
        runs.push(payload);
      },
    };
    await add(deadlineJob("2026-10-24T22:59:00Z"), { name: "day_28", payload: { deliverableId: "del_2" }, runAt: at("2026-10-24T23:00:00Z") });

    await runDueJobs(prisma, handlers, { now: at("2026-10-24T23:00:00Z"), ...quiet });

    expect(runs).toEqual([{ deliverableId: "del_2" }]);
  });

  test("a job can ask to be run again later without that counting as a failure", async () => {
    const waiting: JobHandlers = { deadline: async () => ({ retryAt: at("2026-10-25T10:00:00Z") }) };
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    await runDueJobs(prisma, waiting, { now: at("2026-10-24T22:59:00Z") });

    expect(await prisma.job.findMany()).toMatchObject([
      { status: "pending", failures: 0, runAt: at("2026-10-25T10:00:00Z"), finishedAt: null },
    ]);
  });

  test("a job that fell due while the service was down runs when it comes back", async () => {
    const { runs, handlers } = recording();
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    await runDueJobs(prisma, handlers, { now: at("2026-10-27T08:00:00Z") });

    expect(runs).toHaveLength(1);
  });

  test("a job left running by a worker that died is taken over once its time is up, and not before", async () => {
    const { runs, handlers } = recording();
    await add(deadlineJob("2026-10-24T22:59:00Z"));
    // A worker takes the job at 22:59 and never finishes it. Its claim lasts 5 minutes.
    let tookIt = () => {};
    const taken = new Promise<void>((resolve) => (tookIt = resolve));
    const neverFinishes: JobHandlers = {
      deadline: () => {
        tookIt();
        return new Promise(() => {});
      },
    };
    void runDueJobs(prisma, neverFinishes, { now: at("2026-10-24T22:59:00Z") });
    await taken;

    expect(await runDueJobs(prisma, handlers, { now: at("2026-10-24T23:03:59Z") })).toBe(0);
    expect(await runDueJobs(prisma, handlers, { now: at("2026-10-24T23:04:00Z") })).toBe(1);
    expect(runs).toHaveLength(1);
  });
});
