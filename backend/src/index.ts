import { createAccounts } from "./accounts/accounts";
import { createApp } from "./app";
import { createClaudeBriefModel } from "./briefs/claude";
import { createClaudeJudge } from "./checks/claude-judge";
import { createDataAutomation } from "./checks/data-automation";
import { createNovaVideoModel } from "./checks/nova";
import { prisma } from "./db";
import { createDeals } from "./deals/deals";
import { createDrafts, defaultDraftSettings } from "./drafts/drafts";
import { env } from "./env";
import { createGoogle } from "./google/google";
import { localLinkKeys } from "./invites/link-keys";
import { runDueJobs, type JobHandlers } from "./jobs/jobs";
import { startWorker } from "./jobs/worker";
import { createFfmpegMedia } from "./media/ffmpeg";
import { createResend } from "./email/resend";
import { createMoney } from "./money/money";
import { recordedPosts } from "./money/published-post";
import { createNotices } from "./publish/notices";
import { createPublishedPosts } from "./publish/published-posts";
import { createPublishing, type Publishing } from "./publish/publishing";
import { createYouTubeApi } from "./publish/youtube-api";
import { createReviewLinks } from "./review/links";
import { createReview } from "./review/review";
import { createSandboxPayPal } from "./paypal/sandbox-paypal";
import { localSecrets } from "./secrets/secrets";
import { createS3Storage } from "./storage/s3";

const now = () => new Date();
// What is logged about a call to another service: a status, counts and that service's own ids. Never a
// brief, a code, a token, an email or a payload.
const log = (message: string, details: Record<string, unknown>) => console.error(message, JSON.stringify(details));

if (!env.tokenKey) {
  throw new Error("Missing environment variable TOKEN_KEY. Make one with: openssl rand -base64 32. See backend/.env.example.");
}

// Reading YouTube after a draft is approved: the go-ahead, "I've posted it" and the live check. It uses
// the same Google client as sign-in, with each creator's own read-only access. Without Google set up,
// nothing after approval can run.
const secrets = localSecrets(env.tokenKey);
const reader = env.google && { prisma, youtube: createYouTubeApi({ ...env.google, log }), secrets, demoChannelId: env.demoChannelId };
// Made further down, once the money path exists. A creator who reconnects YouTube restarts what was waiting on it.
let publishing: Publishing | undefined;

const accounts = createAccounts({ prisma, now, onYouTubeConnected: async (creatorId) => publishing?.youtubeConnected(creatorId) });
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
    // Whether a post is published is read from YouTube. Without YouTube, only what the money path was told counts.
    posts: reader ? createPublishedPosts({ ...reader, now }) : recordedPosts(prisma),
    log: (message, details) => console.warn(message, JSON.stringify(details)),
  });
if (!money) {
  console.warn("PayPal is not configured, so no hold can be made and the money jobs do nothing. See backend/.env.example.");
}

// The review of drafts: asks, objections, approval and the review window's timer, and the brand's link to each review.
const linkKeys = localLinkKeys(env.tokenKey);
const reviewLinks = createReviewLinks({ prisma, now, appOrigin: env.appOrigin, linkKeys, money });
const review = createReview({ prisma, now, money, links: reviewLinks });

// Claude as the judge: of drafts, and of a live post's description.
const judge = createClaudeJudge({ model: env.judgeModel, region: env.awsRegion, log });

// Drafts: a private bucket, ffmpeg to read a file, and the three services that check a video. Without
// a bucket the API still starts in development, and takes no draft.
const storage = env.drafts && createS3Storage({ bucket: env.drafts.bucket, region: env.awsRegion });
const drafts =
  env.drafts &&
  storage &&
  createDrafts({
    prisma,
    now,
    storage,
    media: createFfmpegMedia(),
    money,
    links: reviewLinks,
    checks: {
      speech: createDataAutomation({ region: env.awsRegion, bucket: env.drafts.bucket, projectArn: env.drafts.projectArn, profileArn: env.drafts.profileArn, read: storage.read }),
      judge,
      videoModel: createNovaVideoModel({ model: env.drafts.videoModel, region: env.awsRegion, bucket: env.drafts.bucket, log }),
    },
    settings: { ...defaultDraftSettings, sampleKey: env.drafts.sampleKey },
    log,
  });
if (!drafts) {
  console.warn("No bucket for drafts is configured, so no draft can be sent or checked. See backend/.env.example.");
}

// The brand's two notices after a post is live. Without a key nothing is emailed, and the creator's post carries the link.
const notices = createNotices({ prisma, now, links: reviewLinks, email: env.email && createResend({ ...env.email, log }), log });
if (!env.email) {
  console.warn("Email is not configured, so the brand is emailed nothing and the creator sends its link. See backend/.env.example.");
}

// Publishing: the go-ahead, posting and the live check, each read from YouTube and each decided by the money path.
publishing = reader && money ? createPublishing({ ...reader, now, money, judge, notices, log }) : undefined;
if (!publishing) {
  console.warn("Google or PayPal is not configured, so no go-ahead can be given and no live check runs. See backend/.env.example.");
} else if (!env.demoChannelId) {
  console.warn("No demo YouTube channel is set, so a demo account's deal stops once its draft is approved. See backend/.env.example.");
}

const app = createApp({
  prisma,
  accounts,
  deals,
  money,
  review,
  reviewLinks,
  drafts,
  publishing,
  storage,
  appOrigin: env.appOrigin,
  apiOrigin: env.apiOrigin,
  google: env.google && createGoogle({ ...env.google, log }),
  secrets,
  linkKeys,
  // Public by design: PayPal's button on the brand's page needs it. The secret never leaves the service.
  paypalClientId: env.paypal?.clientId,
});

// Timers and follow-ups: reading briefs, deleting demo accounts, and the money path's deadlines and
// unanswered PayPal calls.
const handlers: JobHandlers = { ...accounts.handlers, ...deals.handlers, ...money?.handlers, ...review.handlers, ...drafts?.handlers, ...notices.handlers, ...publishing?.handlers };
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
