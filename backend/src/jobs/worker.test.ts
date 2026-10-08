import { beforeEach, describe, expect, test } from "bun:test";
import { prisma } from "../db";
import { enqueue, runDueJobs, type JobHandlers } from "./jobs";
import { startWorker } from "./worker";

beforeEach(async () => {
  await prisma.job.deleteMany();
});

/** Waits until `done` is true, for at most a second. */
async function until(done: () => boolean | Promise<boolean>) {
  for (let tries = 0; tries < 100 && !(await done()); tries++) await Bun.sleep(10);
}

describe("MP-FR-42 and MP-FR-43 the worker", () => {
  test("a due job runs without anyone asking, and a job written later is picked up too", async () => {
    const ran: unknown[] = [];
    const handlers: JobHandlers = {
      deadline: async (payload) => {
        ran.push(payload);
      },
    };
    const worker = startWorker({ everyMs: 10, pass: () => runDueJobs(prisma, handlers, { now: new Date() }) });
    try {
      await prisma.$transaction((tx) => enqueue(tx, { name: "deadline", payload: { deliverableId: "first" }, runAt: new Date() }));
      await until(() => ran.length === 1);
      await prisma.$transaction((tx) => enqueue(tx, { name: "deadline", payload: { deliverableId: "second" }, runAt: new Date() }));
      await until(() => ran.length === 2);
    } finally {
      await worker.stop();
    }

    expect(ran).toEqual([{ deliverableId: "first" }, { deliverableId: "second" }]);
  });

  test("a pass that fails is logged, without its error's details, and the worker carries on", async () => {
    const logged: unknown[] = [];
    let passes = 0;
    const worker = startWorker({
      everyMs: 5,
      log: (...parts) => logged.push(parts),
      pass: async () => {
        passes++;
        if (passes === 1) throw new Error("could not reach postgres://user:secret@host/db");
      },
    });
    await until(() => passes >= 3);
    await worker.stop();

    expect(passes).toBeGreaterThanOrEqual(3);
    expect(logged).toHaveLength(1);
    expect(JSON.stringify(logged)).not.toContain("secret");
  });

  test("a pass never starts while the last one is still running", async () => {
    let running = 0;
    let mostAtOnce = 0;
    let passes = 0;
    const worker = startWorker({
      everyMs: 1,
      pass: async () => {
        running++;
        mostAtOnce = Math.max(mostAtOnce, running);
        await Bun.sleep(20);
        running--;
        passes++;
      },
    });
    await until(() => passes >= 3);
    await worker.stop();

    expect(mostAtOnce).toBe(1);
  });

  test("stopping waits for the pass in flight to finish, and starts no more", async () => {
    let finished = 0;
    let started = 0;
    const worker = startWorker({
      everyMs: 1,
      pass: async () => {
        started++;
        await Bun.sleep(30);
        finished++;
      },
    });
    await until(() => started === 1);

    await worker.stop();
    const atStop = { started, finished };
    await Bun.sleep(60);

    expect(atStop).toEqual({ started: 1, finished: 1 });
    expect(started).toBe(1);
  });
});
