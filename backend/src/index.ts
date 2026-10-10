import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import { createClaudeBriefModel } from "./briefs/claude";
import { prisma } from "./db";
import { createDeals } from "./deals/deals";
import { defaultDraftSettings } from "./drafts/drafts";
import { env } from "./env";
import { createGoogle } from "./google/google";
import { localLinkKeys } from "./invites/link-keys";
import { runDueJobs, type JobHandlers } from "./jobs/jobs";
import { startWorker } from "./jobs/worker";
import { createMoney } from "./money/money";
import { recordedPosts } from "./money/published-post";
import { createReviewLinks } from "./review/links";
import { createReview } from "./review/review";
import { createSandboxPayPal } from "./paypal/sandbox-paypal";
import { localSecrets } from "./secrets/secrets";

const now = () => new Date();
// What is logged about a call to another service: a status, counts and that service's own ids. Never a
// brief, a code, a token, an email or a payload.
const log = (message: string, details: Record<string, unknown>) => console.error(message, JSON.stringify(details));

if (!env.tokenKey) {
  throw new Error("Missing environment variable TOKEN_KEY. Make one with: openssl rand -base64 32. See backend/.env.example.");
}

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

// The review of drafts: asks, objections, approval and the review window's timer, and the brand's link to each review.
const linkKeys = localLinkKeys(env.tokenKey);
const reviewLinks = createReviewLinks({ prisma, now, appOrigin: env.appOrigin, linkKeys, money });
const review = createReview({ prisma, now, money, links: reviewLinks });

const app = createApp({
  prisma,
  accounts,
  deals,
  money,
  review,
  reviewLinks,
  appOrigin: env.appOrigin,
  apiOrigin: env.apiOrigin,
  google: env.google && createGoogle({ ...env.google, log }),
  secrets: localSecrets(env.tokenKey),
  linkKeys,
  // Public by design: PayPal's button on the brand's page needs it. The secret never leaves the service.
  paypalClientId: env.paypal?.clientId,
});

// Timers and follow-ups: reading briefs, deleting demo accounts, and the money path's deadlines and
// unanswered PayPal calls.
const handlers: JobHandlers = { ...accounts.handlers, ...deals.handlers, ...money?.handlers, ...review.handlers };
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
  // Bun turns away anything larger than this before the app sees it. A draft's file is the largest
  // thing sent; every other route has its own, much smaller limit.
  maxRequestBodySize: defaultDraftSettings.maxBytes + 1024 * 1024,
};
