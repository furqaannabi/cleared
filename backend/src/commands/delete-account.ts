/**
 * The command a person at Sponing deletes an account with, when its creator asked by email and
 * cannot do it themselves in Settings (account and history spec AH-FR-22;
 * docs/decisions/2026-10-12-deleting-an-account-keeps-the-money-records.md). Run from the backend
 * folder by someone with access to the service:
 *
 *   pnpm delete-account creator@example.com
 *
 * It runs the same code as `DELETE /me`: refused while a deal is open, with what is in the way
 * printed; otherwise everything the creator made and said is deleted, and each held post's money
 * records are kept with no name or email. It asks for the email to be typed again first. The files
 * leave the bucket by a job the running service works through. Nothing here is a route.
 */
import { createInterface } from "node:readline/promises";
import { deleteByEmail } from "../accounts/delete-command";
import { createAccountRemoval } from "../accounts/removal";
import { prisma } from "../db";
import { env } from "../env";
import { createGoogle } from "../google/google";
import { createMoney } from "../money/money";
import { recordedPosts } from "../money/published-post";
import { createSandboxPayPal } from "../paypal/sandbox-paypal";
import { localSecrets } from "../secrets/secrets";

async function main(args: string[]): Promise<number> {
  if (!env.tokenKey) {
    console.error("Missing environment variable TOKEN_KEY. See backend/.env.example.");
    return 1;
  }
  const log = (message: string, details: Record<string, unknown>) => console.error(message, JSON.stringify(details));
  // The money path is asked one thing only: to take the creator's PayPal email off the records that are kept. PayPal is not called.
  const money = env.paypal && createMoney({ prisma, paypal: createSandboxPayPal({ ...env.paypal, log }), posts: recordedPosts(prisma), log });
  const removal = createAccountRemoval({ prisma, google: env.google && createGoogle({ ...env.google, log }), secrets: localSecrets(env.tokenKey), money, log });

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await deleteByEmail({ prisma, removal, ask: (question) => terminal.question(question), print: (line) => console.log(line) }, args);
  } finally {
    terminal.close();
    await prisma.$disconnect();
  }
}

process.exit(await main(process.argv.slice(2)));
