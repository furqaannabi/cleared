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
 * Google's OAuth client, for signing in and connecting YouTube, and the key that encrypts the refresh
 * tokens it gives. In development the API starts without them and only the demo account can sign in.
 * In production they are required. With a Google client, the key is always required.
 */
function google(): { clientId: string; clientSecret: string; tokenKey: string } | undefined {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tokenKey = process.env.TOKEN_KEY;
  if (clientId && clientSecret) {
    if (!tokenKey) throw new Error("Missing TOKEN_KEY, which encrypts Google's tokens. See backend/.env.example.");
    return { clientId, clientSecret, tokenKey };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. See backend/.env.example.");
  }
  return undefined;
}

const port = Number(process.env.PORT ?? 4000);

/** The service's configuration, read once at start-up. */
export const env = {
  databaseUrl: required("DATABASE_URL"),
  port,
  /** The API's own address, which Google sends the browser back to. */
  apiOrigin: process.env.API_ORIGIN ?? `http://localhost:${port}`,
  google: google(),
  /** Bedrock's id for the model that reads briefs, and the AWS region it is called in. */
  briefModel: process.env.BRIEF_MODEL ?? "anthropic.claude-opus-5-5",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  /** The address of Cleared's own app: the only origin that may make changing requests (DS-BR-03). */
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  paypal: paypal(),
};
