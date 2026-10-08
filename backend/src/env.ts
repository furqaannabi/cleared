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

/** The service's configuration, read once at start-up. */
export const env = {
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.PORT ?? 4000),
  paypal: paypal(),
};
