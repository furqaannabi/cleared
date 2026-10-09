import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import { prisma } from "./db";
import { env } from "./env";
import { createGoogle } from "./google/google";
import { runDueJobs } from "./jobs/jobs";
import { startWorker } from "./jobs/worker";
import { createMoney } from "./money/money";
import { recordedPosts } from "./money/published-post";
import { createSandboxPayPal } from "./paypal/sandbox-paypal";
import { localSecrets } from "./secrets/secrets";

const accounts = createAccounts({ prisma, now: () => new Date() });
// A failed call is logged with its status only, never a code, a token or an email.
const logFailure = (message: string, details: Record<string, unknown>) => console.error(message, JSON.stringify(details));
const base = {
  prisma,
  accounts,
  appOrigin: env.appOrigin,
  apiOrigin: env.apiOrigin,
  google: env.google && createGoogle({ ...env.google, log: logFailure }),
  secrets: env.google && localSecrets(env.google.tokenKey),
};
if (!env.google) {
  console.warn("Google is not configured, so only the demo account can sign in. See backend/.env.example.");
}
let app = createApp(base);

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
  app = createApp({ ...base, money });
  // The money path's timers and follow-ups (deadlines, review windows, calls PayPal has not answered).
  const handlers = { ...money.handlers, ...accounts.handlers };
  const worker = startWorker({ pass: () => runDueJobs(prisma, handlers, { now: new Date() }) });
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
