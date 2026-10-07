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

/** The service's configuration, read once at start-up. */
export const env = {
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.PORT ?? 4000),
};
