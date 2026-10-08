/**
 * Runs the due jobs on a timer, inside the service (money path spec MP-FR-42, MP-FR-43). Several
 * instances of the service can each run one: a job is claimed under a row lock, so it still runs once.
 */

export interface Worker {
  /** Stops the worker. It waits for the pass in flight to finish, and starts no more. */
  stop(): Promise<void>;
}

export function startWorker(options: {
  /** One pass over the jobs that are due. */
  pass: () => Promise<unknown>;
  /** How long to rest between passes. */
  everyMs?: number;
  log?: (...parts: unknown[]) => void;
}): Worker {
  const everyMs = options.everyMs ?? 5_000;
  const log = options.log ?? console.error;
  let stopped = false;
  let wake: (() => void) | undefined;

  // One pass at a time: the next one starts only after the last has finished and the rest is over.
  const loop = (async () => {
    while (!stopped) {
      try {
        await options.pass();
      } catch (error) {
        // The kind of error only. Its message can carry a connection string or a payload.
        log("A pass over the due jobs failed and will be tried again", { error: error instanceof Error ? error.name : "unknown" });
      }
      if (stopped) break;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, everyMs);
        wake = () => {
          clearTimeout(timer);
          resolve();
        };
      });
    }
  })();

  return {
    async stop() {
      stopped = true;
      wake?.();
      await loop;
    },
  };
}
