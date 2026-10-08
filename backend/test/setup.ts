/**
 * Runs once before any test file (bunfig.toml). Points the tests at their own database, apart from the
 * development one, and brings its tables up to date
 * (docs/decisions/2026-10-08-backend-test-tooling.md).
 */
import { SQL } from "bun";

const developmentUrl = process.env.DATABASE_URL;
if (!developmentUrl) throw new Error("Missing DATABASE_URL. See backend/.env.example.");

const testUrl = new URL(developmentUrl);
const testDatabase = `${testUrl.pathname.slice(1)}_test`;
testUrl.pathname = `/${testDatabase}`;

// Everything imported after this line, including the Prisma client, sees only the test database.
process.env.DATABASE_URL = testUrl.toString();

const development = new SQL(developmentUrl);
const [existing] = await development`SELECT 1 FROM pg_database WHERE datname = ${testDatabase}`;
if (!existing) await development.unsafe(`CREATE DATABASE "${testDatabase}"`);
await development.close();

const migrate = Bun.spawnSync(["bun", "--bun", "prisma", "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: testUrl.toString() },
  stdout: "pipe",
  stderr: "pipe",
});
if (migrate.exitCode !== 0) {
  throw new Error(`Could not migrate the test database:\n${migrate.stderr.toString()}`);
}
