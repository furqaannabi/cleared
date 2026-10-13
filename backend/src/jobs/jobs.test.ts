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
      { status: "pending", failures: 1, runAt: at("2026-10-24T23:00:00Z"), lastError: expect.stringMatching(/^Error at src\/jobs\/jobs\.test\.ts:\d+/) },
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

  test("after the limit it is marked failed, and never run again", async () => {
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
    // Each failure has its own line, and the last says the job has given up (DS-FR-52).
    expect(logged.map((parts) => (parts as [string, { next: string }])[1].next)).toEqual(["retry", "gave_up"]);
    expect(JSON.stringify(logged)).toContain(job!.id);
  });

  test("a job nobody knows how to run counts as a failure", async () => {
    await add({ name: "no_such_job", payload: {}, runAt: at("2026-10-24T22:59:00Z") });

    await runDueJobs(prisma, {}, { now: at("2026-10-24T22:59:00Z"), ...quiet });

    expect(await prisma.job.findMany()).toMatchObject([
      { status: "pending", failures: 1, lastError: expect.stringMatching(/^Error at src\/jobs\/jobs\.ts:\d+/) },
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

describe("MP-FR-38 backing off between tries", () => {
  test("a job is told how many times it has been started, so it can wait longer each time", async () => {
    const seen: number[] = [];
    const handlers: JobHandlers = {
      deadline: async (_payload, { attempts, now }) => {
        seen.push(attempts);
        return attempts < 3 ? { retryAt: new Date(now.getTime() + 60_000) } : undefined;
      },
    };
    await add(deadlineJob("2026-10-24T22:59:00Z"));

    await runDueJobs(prisma, handlers, { now: at("2026-10-24T22:59:00Z") });
    await runDueJobs(prisma, handlers, { now: at("2026-10-24T23:00:00Z") });
    await runDueJobs(prisma, handlers, { now: at("2026-10-24T23:01:00Z") });

    expect(seen).toEqual([1, 2, 3]);
    expect(await prisma.job.findMany()).toMatchObject([{ status: "done", attempts: 3, failures: 0 }]);
  });
});

describe("DS-FR-52, DS-FR-53 a job that fails is logged at once, and kept, without its message", () => {
  class DatabaseSaidNo extends Error {
    code = "P2002";
    constructor() {
      super("Unique constraint failed on sam.pay@example.com with token ya29.A0ARrdaM-refresh");
      this.name = "DatabaseSaidNo";
    }
  }
  const failing: JobHandlers = {
    deadline: async () => {
      throw new DatabaseSaidNo();
    },
  };
  function collecting() {
    const logged: [string, Record<string, unknown>][] = [];
    return { logged, log: (...parts: unknown[]) => void logged.push(parts as [string, Record<string, unknown>]) };
  }
  const POST = "4f0c2d5e-0000-4000-8000-000000000001";
  const DEAL = "9a1b7c3d-0000-4000-8000-000000000002";

  test("each failure is logged when it happens: the job, the deal and the post, which try it was, what comes next, and the error by its name, its code and where it was thrown", async () => {
    const { logged, log } = collecting();
    await add({ name: "deadline", payload: { deliverableId: POST, dealId: DEAL }, runAt: at("2026-10-24T22:59:00Z") });

    await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:00Z"), log });

    const [job] = await prisma.job.findMany();
    expect(logged).toEqual([
      ["A job failed", { jobId: job!.id, name: "deadline", dealId: DEAL, deliverableId: POST, attempt: 1, failures: 1, next: "retry", error: "DatabaseSaidNo", code: "P2002", at: expect.any(Array) }],
    ]);
    expect((logged[0]![1].at as string[])[0]).toMatch(/^src\/jobs\/jobs\.test\.ts:\d+$/);
  });

  test("the try that is the last says the job has given up, and nothing more is logged for it", async () => {
    const { logged, log } = collecting();
    const settings = { ...defaultJobSettings, maxFailures: 2 };
    await add(deadlineJob("2026-10-24T22:59:00Z", POST));

    await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:00Z"), settings, log });
    await runDueJobs(prisma, failing, { now: at("2026-10-24T23:00:00Z"), settings, log });
    await runDueJobs(prisma, failing, { now: at("2026-10-30T00:00:00Z"), settings, log });

    expect(logged.map(([message, details]) => ({ message, attempt: details.attempt, failures: details.failures, next: details.next }))).toEqual([
      { message: "A job failed", attempt: 1, failures: 1, next: "retry" },
      { message: "A job failed", attempt: 2, failures: 2, next: "gave_up" },
    ]);
  });

  test("the error's message is in neither the log nor the jobs table", async () => {
    const { logged, log } = collecting();
    await add(deadlineJob("2026-10-24T22:59:00Z", POST));

    await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:00Z"), log });

    const everywhere = `${JSON.stringify(logged)}${JSON.stringify(await prisma.job.findMany())}`;
    for (const never of ["sam.pay@example.com", "ya29", "Unique constraint"]) expect(everywhere).not.toContain(never);
  });

  test("the table keeps the error's name, its code and where it was thrown, and no more", async () => {
    await add(deadlineJob("2026-10-24T22:59:00Z", POST));

    await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:00Z"), log: () => {} });

    const [job] = await prisma.job.findMany();
    expect(job!.lastError).toMatch(/^DatabaseSaidNo P2002 at src\/jobs\/jobs\.test\.ts:\d+(, [\w./-]+:\d+)*$/);
  });

  test("a job that finishes, and one that waits to be run again, log nothing", async () => {
    const { logged, log } = collecting();
    const handlers: JobHandlers = { deadline: async () => {}, poll: async () => ({ retryAt: at("2026-10-24T23:10:00Z") }) };
    await add(deadlineJob("2026-10-24T22:59:00Z", POST), { name: "poll", payload: {}, runAt: at("2026-10-24T22:59:00Z") });

    expect(await runDueJobs(prisma, handlers, { now: at("2026-10-24T22:59:00Z"), log })).toBe(2);

    expect(logged).toEqual([]);
  });

  test("only ids are taken from a payload, and only if they look like ids: nothing else in it is logged", async () => {
    const { logged, log } = collecting();
    await add({ name: "deadline", payload: { deliverableId: "not an id <script>", dealId: DEAL, note: "a brand's own words", creatorEmail: "sam@example.com" }, runAt: at("2026-10-24T22:59:00Z") });

    await runDueJobs(prisma, failing, { now: at("2026-10-24T22:59:00Z"), log });

    expect(logged[0]![1]).toMatchObject({ dealId: DEAL });
    expect(logged[0]![1]).not.toHaveProperty("deliverableId");
    for (const never of ["script", "brand's own words", "sam@example.com"]) expect(JSON.stringify(logged)).not.toContain(never);
  });

  test("something thrown that is not an error is a failure all the same, with nothing of it kept", async () => {
    const { logged, log } = collecting();
    const handlers: JobHandlers = {
      deadline: async () => {
        throw "sam.pay@example.com could not be paid";
      },
    };
    await add(deadlineJob("2026-10-24T22:59:00Z", POST));

    await runDueJobs(prisma, handlers, { now: at("2026-10-24T22:59:00Z"), log });

    expect(logged[0]![1]).toMatchObject({ error: "Error", next: "retry", at: [] });
    expect(`${JSON.stringify(logged)}${JSON.stringify(await prisma.job.findMany())}`).not.toContain("sam.pay");
    expect((await prisma.job.findMany())[0]!.lastError).toBe("Error");
  });
});
