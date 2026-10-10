/**
 * The commands a person at Cleared rules with (publish to paid spec PT-FR-34, PT-FR-35;
 * docs/decisions/2026-10-10-a-ruling-is-a-command-not-a-page.md). Run from the backend folder by
 * someone with access to the service:
 *
 *   pnpm rulings list
 *   pnpm rulings rule <post id> pay --by "Your Name"
 *   pnpm rulings rule <post id> release --by "Your Name"
 *
 * "pay" approves paying and the hold is captured; "release" gives the hold back to the brand. Either
 * is final. The money path decides whether there is anything to rule on, and does the rest; the
 * running service follows up on what PayPal has not answered. Nothing here is a route.
 */
import { prisma } from "../db";
import { env } from "../env";
import { createMoney } from "../money/money";
import { recordedPosts } from "../money/published-post";
import { createSandboxPayPal } from "../paypal/sandbox-paypal";
import { createRulings, printed } from "../rulings/rulings";

const USAGE = 'Usage:\n  pnpm rulings list\n  pnpm rulings rule <post id> <pay|release> --by "Your Name"';

async function main(args: string[]): Promise<number> {
  if (!env.paypal) {
    console.error("PayPal is not configured, so nothing can be ruled on. See backend/.env.example.");
    return 1;
  }
  const log = (message: string, details: Record<string, unknown>) => console.error(message, JSON.stringify(details));
  const money = createMoney({ prisma, paypal: createSandboxPayPal({ ...env.paypal, log }), posts: recordedPosts(prisma), log });
  const rulings = createRulings({ prisma, now: () => new Date(), money });

  const [command, deliverableId, decision, flag, ...name] = args;
  if (command === "list" && args.length === 1) {
    console.log(printed(await rulings.list()));
    return 0;
  }
  if (command === "rule" && deliverableId && (decision === "pay" || decision === "release") && flag === "--by" && name.length > 0) {
    const ruled = await rulings.rule(deliverableId, decision, name.join(" "));
    if (ruled.ok) {
      console.log(decision === "pay" ? "Ruled: pay. The hold is being captured and the creator will be paid." : "Ruled: release. The hold is being given back to the brand.");
      return 0;
    }
    console.error(`Not ruled: ${ruled.reason}. Nothing changed.`);
    return 1;
  }
  console.error(USAGE);
  return 2;
}

const code = await main(process.argv.slice(2));
await prisma.$disconnect();
process.exit(code);
