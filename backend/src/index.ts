import { createApp } from "./app";
import { prisma } from "./db";
import { env } from "./env";
import { runDueJobs } from "./jobs/jobs";
import { startWorker } from "./jobs/worker";
import { createMoney } from "./money/money";
import { recordedPosts } from "./money/published-post";
import { createSandboxPayPal } from "./paypal/sandbox-paypal";

let app = createApp({ prisma });

if (env.paypal) {
  // A failed PayPal call is logged with its status and PayPal's own id, never a payload.
  const paypal = createSandboxPayPal({
    ...env.paypal,
    log: (message, details) => console.error(message, JSON.stringify(details)),
  });
  const money = createMoney({
    prisma,
    paypal,
    posts: recordedPosts(prisma),
    log: (message, details) => console.warn(message, JSON.stringify(details)),
  });
  app = createApp({ prisma, money });
  // The money path's timers and follow-ups (deadlines, review windows, calls PayPal has not answered).
  const worker = startWorker({ pass: () => runDueJobs(prisma, money.handlers, { now: new Date() }) });
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, async () => {
      // Let the job in flight finish, so nothing is left half done.
      await worker.stop();
      await prisma.$disconnect();
      process.exit(0);
    });
  }
} else {
  console.warn("PayPal is not configured, so the money jobs are not running. See backend/.env.example.");
}

export default {
  port: env.port,
  fetch: app.fetch,
};
