import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import { createClaudeBriefModel } from "./briefs/claude";
import { prisma } from "./db";
import { createDeals } from "./deals/deals";
import { env } from "./env";
import { createGoogle } from "./google/google";
import { runDueJobs, type JobHandlers } from "./jobs/jobs";
import { startWorker } from "./jobs/worker";
import { createMoney } from "./money/money";
import { recordedPosts } from "./money/published-post";
import { createSandboxPayPal } from "./paypal/sandbox-paypal";
import { localSecrets } from "./secrets/secrets";

const now = () => new Date();
// What is logged about a call to another service: a status, counts and that service's own ids. Never a
// brief, a code, a token, an email or a payload.
const log = (message: string, details: Record<string, unknown>) => console.error(message, JSON.stringify(details));

const accounts = createAccounts({ prisma, now });
// Briefs are read by Claude on Amazon Bedrock, with the AWS credentials the service runs under.
const deals = createDeals({
  prisma,
  now,
  model: createClaudeBriefModel({ model: env.briefModel, region: env.awsRegion, log }),
});
if (!env.google) {
  console.warn("Google is not configured, so only the demo account can sign in. See backend/.env.example.");
}

// PayPal's sandbox, and the money path on top of it. Without credentials the API still starts in development.
const money =
  env.paypal &&
  createMoney({
    prisma,
    paypal: createSandboxPayPal({ ...env.paypal, log }),
    posts: recordedPosts(prisma),
    log: (message, details) => console.warn(message, JSON.stringify(details)),
  });
if (!money) {
  console.warn("PayPal is not configured, so no hold can be made and the money jobs do nothing. See backend/.env.example.");
}

const app = createApp({
  prisma,
  accounts,
  deals,
  money,
  appOrigin: env.appOrigin,
  apiOrigin: env.apiOrigin,
  google: env.google && createGoogle({ ...env.google, log }),
  secrets: env.google && localSecrets(env.google.tokenKey),
});

// Timers and follow-ups: reading briefs, deleting demo accounts, and the money path's deadlines and
// unanswered PayPal calls.
const handlers: JobHandlers = { ...accounts.handlers, ...deals.handlers, ...money?.handlers };
const worker = startWorker({ pass: () => runDueJobs(prisma, handlers, { now: now() }) });
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, async () => {
    // Let the job in flight finish, so nothing is left half done.
    await worker.stop();
    await prisma.$disconnect();
    process.exit(0);
  });
}

export default {
  port: env.port,
  fetch: app.fetch,
};
