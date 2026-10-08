/**
 * Steps one deliverable's money through the money module against PayPal's real sandbox and the
 * development database (money path spec MP-FR-44). Development only.
 *
 *   pnpm sandbox:money            lists the commands
 *   pnpm sandbox:money new 1200   makes a $1,200.00 test deliverable and prints PayPal's approval link
 *
 * It needs the database running (`pnpm db:up`) and the sandbox credentials in .env.
 */
import { prisma } from "../src/db";
import { sandboxPayPalFromEnv } from "../src/paypal/sandbox-paypal";
import { runMoneyCommand } from "./money-commands";

// A failed PayPal call is shown with its status and PayPal's own id, never a payload.
const paypal = sandboxPayPalFromEnv({ log: (message, details) => console.error(message, JSON.stringify(details)) });
const result = await runMoneyCommand({ prisma, paypal, argv: process.argv.slice(2) });
for (const line of result.lines) console.log(line);
await prisma.$disconnect();
process.exit(result.exitCode);
