/**
 * Timers and retries, kept as rows in Postgres (money path spec MP-FR-42, MP-FR-43;
 * docs/decisions/2026-10-08-jobs-table-in-postgres.md).
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client";

/** A job to run at or after `runAt`. The payload carries ids only, never emails, tokens or PayPal payloads. */
export interface NewJob {
  name: string;
  payload: Prisma.InputJsonObject;
  runAt: Date;
}

/**
 * Does a job's work. It may run more than once for the same job, so it checks recorded state first.
 * Returning `retryAt` asks to be run again then; that is waiting, not failing. Throwing is failing.
 */
export type JobHandler = (payload: unknown, context: { now: Date }) => Promise<void | { retryAt: Date }>;

/** The handlers a worker knows, by job name. */
export type JobHandlers = Record<string, JobHandler>;

export interface JobSettings {
  /** How many failures a job is allowed before it is marked failed (MP-FR-43). */
  maxFailures: number;
  /** The wait after the first failure. It doubles after each further one, up to the longest wait. */
  firstRetrySeconds: number;
  longestRetrySeconds: number;
  /** How long a worker may hold a job before another may take it over, in case the first one died. */
  claimSeconds: number;
}

export const defaultJobSettings: JobSettings = {
  maxFailures: 12,
  firstRetrySeconds: 60,
  longestRetrySeconds: 6 * 3600,
  claimSeconds: 5 * 60,
};

export interface RunOptions {
  /** The moment the worker is running at. Passed in so the runner has no clock of its own. */
  now: Date;
  settings?: JobSettings;
  /** Where a job that has given up is reported. It is given the job's id and name, never its payload. */
  log?: (...parts: unknown[]) => void;
}

/**
 * Writes a job inside the caller's transaction, so it exists only if the change it belongs to does (MP-FR-42).
 * It takes a transaction on purpose: there is no way to write a job on its own.
 */
export async function enqueue(tx: Prisma.TransactionClient, job: NewJob): Promise<void> {
  await tx.job.create({ data: job });
}

interface ClaimedJob {
  id: string;
  name: string;
  payload: unknown;
  failures: number;
}

const secondsAfter = (from: Date, seconds: number) => new Date(from.getTime() + seconds * 1000);

/**
 * Takes the job that fell due first, if there is one: a pending job whose time has come, or a running one
 * whose worker has held it past its claim. The row is locked while it is chosen and marked running in the
 * same statement, so two workers can never take the same job (MP-FR-42).
 */
async function claim(prisma: PrismaClient, now: Date, settings: JobSettings): Promise<ClaimedJob | undefined> {
  const claimEnds = secondsAfter(now, settings.claimSeconds);
  const [job] = await prisma.$queryRaw<ClaimedJob[]>`
    UPDATE "Job"
    SET "status" = 'running', "lockedUntil" = ${claimEnds}, "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE ("status" = 'pending' AND "runAt" <= ${now})
         OR ("status" = 'running' AND "lockedUntil" <= ${now})
      ORDER BY "runAt"
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "name", "payload", "failures"`;
  return job;
}

/** The wait before the next try: it doubles with each failure, up to the longest wait (MP-FR-43). */
const retryDelaySeconds = (failures: number, settings: JobSettings) =>
  Math.min(settings.firstRetrySeconds * 2 ** (failures - 1), settings.longestRetrySeconds);

/** Only the message, shortened. An error can carry a response body, and that must not reach the table. */
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error").slice(0, 500);

/** Runs every job that is due at `now`, one at a time, and returns how many it ran. */
export async function runDueJobs(prisma: PrismaClient, handlers: JobHandlers, options: RunOptions): Promise<number> {
  const { now, settings = defaultJobSettings, log = console.error } = options;
  let ran = 0;
  for (;;) {
    const job = await claim(prisma, now, settings);
    if (!job) return ran;
    ran++;
    try {
      const handler = handlers[job.name];
      if (!handler) throw new Error(`No handler for job ${job.name}`);
      const result = await handler(job.payload, { now });
      if (result?.retryAt) {
        // Never back into this same run: a job that asks for "now" would be picked up again at once.
        const runAt = result.retryAt > now ? result.retryAt : secondsAfter(now, settings.firstRetrySeconds);
        await prisma.job.update({ where: { id: job.id }, data: { status: "pending", runAt, lockedUntil: null } });
      } else {
        await prisma.job.update({ where: { id: job.id }, data: { status: "done", finishedAt: now, lockedUntil: null } });
      }
    } catch (error) {
      const failures = job.failures + 1;
      const gaveUp = failures >= settings.maxFailures;
      await prisma.job.update({
        where: { id: job.id },
        data: gaveUp
          ? { status: "failed", failures, lastError: errorMessage(error), finishedAt: now, lockedUntil: null }
          : {
              status: "pending",
              failures,
              lastError: errorMessage(error),
              runAt: secondsAfter(now, retryDelaySeconds(failures, settings)),
              lockedUntil: null,
            },
      });
      if (gaveUp) log("Job gave up after its retry limit", { id: job.id, name: job.name, failures });
    }
  }
}
