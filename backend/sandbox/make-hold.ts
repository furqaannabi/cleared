/**
 * Makes one real hold in PayPal's sandbox, so there is one old enough to renew when that is tested:
 * PayPal renews a hold only after its 3-day guarantee has ended (money path spec, "To verify in the sandbox").
 *
 *   pnpm sandbox:hold          a $20.00 hold
 *   pnpm sandbox:hold 1200     a $1,200.00 hold
 *
 * It prints a link. Open it, log in as a sandbox PERSONAL account (the brand) and approve, then come back
 * and press Enter. The hold's PayPal reference is saved in sandbox/holds.local.json, which is gitignored.
 * Development only.
 */
import { sandboxPayPalFromEnv } from "../src/paypal/sandbox-paypal";

if (process.env.NODE_ENV === "production") {
  console.error("This script is for development only.");
  process.exit(1);
}

const dollarsArg = process.argv[2] ?? "20";
if (!/^\d+(\.\d{1,2})?$/.test(dollarsArg)) {
  console.error("Give the amount in dollars, like 20 or 1200.50.");
  process.exit(1);
}
const [whole = "0", fraction = ""] = dollarsArg.split(".");
const amountCents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

const paypal = sandboxPayPalFromEnv();
const order = await paypal.createOrder({ requestId: crypto.randomUUID(), deliverableId: "sandbox-hold", amountCents });
if (order.outcome !== "created") {
  console.error("PayPal did not create the order. Check the credentials in .env.");
  process.exit(1);
}

console.log(`\nOrder ${order.orderId} for $${(amountCents / 100).toFixed(2)}.`);
console.log("Approve it as a sandbox personal account:\n");
console.log(`  ${order.approveUrl}\n`);
console.log("After approving, the browser may show an error page or PayPal's own page. That is fine.");

const requestId = crypto.randomUUID();
for (;;) {
  if (prompt("Press Enter once you have approved it (Ctrl+C to give up).") === null) {
    console.error("\nNo terminal to wait on. Run this in a terminal of your own.");
    process.exit(1);
  }
  const answer = await paypal.authorizeOrder({ requestId, orderId: order.orderId });
  const result = answer.outcome === "unknown" ? await paypal.readOrder(order.orderId) : answer;
  if (result.outcome === "held") {
    const file = Bun.file(new URL("./holds.local.json", import.meta.url));
    const holds: unknown[] = (await file.exists()) ? await file.json() : [];
    holds.push({ reference: result.reference, orderId: order.orderId, amountCents, heldAt: new Date().toISOString() });
    await Bun.write(file, `${JSON.stringify(holds, null, 2)}\n`);
    console.log(`\nHeld. PayPal reference ${result.reference}. It can be renewed from ${renewableFrom()}.`);
    break;
  }
  console.log(
    result.outcome === "declined" || result.outcome === "not_held"
      ? "PayPal has not held it. It may not be approved yet."
      : `PayPal's answer was "${result.outcome}".`,
  );
}

function renewableFrom(): string {
  return new Date(Date.now() + 3 * 24 * 3_600_000).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}
