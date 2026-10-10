/**
 * Reads a required environment variable, and stops the service at start-up
 * with a clear message if it is missing. The value is never logged.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See backend/.env.example.`);
  }
  return value;
}

/**
 * PayPal's sandbox credentials. In development the API starts without them, for work that does not touch
 * money, and the money jobs do not run. In production they are required.
 */
function paypal(): { clientId: string; clientSecret: string; webhookId?: string } | undefined {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (clientId && clientSecret) return { clientId, clientSecret, webhookId: process.env.PAYPAL_WEBHOOK_ID || undefined };
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET. See backend/.env.example.");
  }
  return undefined;
}

/**
 * Google's OAuth client, for signing in and connecting YouTube. In development the API starts without
 * it and only the demo account can sign in. In production it is required.
 */
function google(): { clientId: string; clientSecret: string } | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (clientId && clientSecret) return { clientId, clientSecret };
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. See backend/.env.example.");
  }
  return undefined;
}

/**
 * Where drafts are kept and what checks them (draft check and review spec). In development the API
 * starts without them and takes no draft. If the bucket is set, the Data Automation project and
 * profile must be too: a draft that is stored but can never be checked helps nobody.
 */
function drafts(): { bucket: string; projectArn: string; profileArn: string; videoModel: string; sampleKey?: string } | undefined {
  const bucket = process.env.DRAFTS_BUCKET;
  if (!bucket) return undefined;
  const projectArn = process.env.DATA_AUTOMATION_PROJECT_ARN;
  const profileArn = process.env.DATA_AUTOMATION_PROFILE_ARN;
  if (!projectArn || !profileArn) {
    throw new Error("DRAFTS_BUCKET is set, so DATA_AUTOMATION_PROJECT_ARN and DATA_AUTOMATION_PROFILE_ARN are needed too. See backend/.env.example.");
  }
  return { bucket, projectArn, profileArn, videoModel: process.env.VIDEO_MODEL ?? "us.amazon.nova-pro-v1:0", sampleKey: process.env.SAMPLE_VIDEO_KEY || undefined };
}

const port = Number(process.env.PORT ?? 4000);

/** The service's configuration, read once at start-up. */
export const env = {
  databaseUrl: required("DATABASE_URL"),
  port,
  /** The API's own address, which Google sends the browser back to. */
  apiOrigin: process.env.API_ORIGIN ?? `http://localhost:${port}`,
  google: google(),
  /**
   * The key the brand's links are worked out from and Google's tokens are encrypted with. The service
   * does not start without it (see index.ts). It is not asked for here, because the tests read these
   * settings too and bring keys of their own.
   */
  tokenKey: process.env.TOKEN_KEY || undefined,
  /** Bedrock's id for the model that reads briefs, and the AWS region it is called in. */
  briefModel: process.env.BRIEF_MODEL ?? "anthropic.claude-opus-5-5",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  /** Bedrock's id for the model that judges drafts. The one that reads briefs, unless set apart. */
  judgeModel: process.env.JUDGE_MODEL ?? process.env.BRIEF_MODEL ?? "anthropic.claude-opus-5-5",
  drafts: drafts(),
  /** The address of Cleared's own app: the only origin that may make changing requests (DS-BR-03). */
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  paypal: paypal(),
};
