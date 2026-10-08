/**
 * The sandbox script's commands (money path spec MP-FR-44): one deliverable's money, stepped through the
 * money module one command at a time. Development only.
 *
 * Kept apart from the entry file so the commands can be tested against the fake PayPal.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import { runDueJobs } from "../src/jobs/jobs";
import { createMoney, type Money } from "../src/money/money";
import type { MoneyView } from "../src/money/view";
import type { PayPalPort } from "../src/paypal/port";

export const USAGE = [
  "pnpm sandbox:money <command>",
  "",
  "  new [dollars] [--days n] [--email creator@…]   make a test deliverable and start its hold",
  "  hold <id>                                      start a hold again, after one was closed or declined",
  "  approved <id>                                  the brand approved in PayPal: hold the money",
  "  closed <id>                                    the brand closed PayPal without approving",
  "  draft-cleared <id>                             the draft is cleared to publish",
  "  go-ahead <id>                                  the creator asks to publish: re-confirm the hold",
  "  published <id>                                 the approved post is live",
  "  live-check <id> passed|cannot_decide|failed_fixable|failed_not_fixable",
  "  confirm <id> | object <id> | accept <id>       the brand's answer about a live post",
  "  rule <id> pay|release                          Cleared's ruling on an objection",
  "  cancel <id> creator|brand",
  "  payout-again <id> [new-email]                  send the payout again, after one ended unpaid",
  "  jobs                                           run every job that is due",
  "  show <id> | list",
  "",
  "  --at <time>   run the command as if it were that moment, for example 2026-10-18T10:00:00Z.",
  "                PayPal keeps its own clock: a hold can only be renewed once it is really 3 days old.",
];

/** With no PayPal account behind it, a payout to this address sits unclaimed, which is a flow worth seeing. */
const DEFAULT_PAYOUT_EMAIL = "cleared-sandbox-creator@example.com";

export interface CommandResult {
  lines: string[];
  exitCode: number;
}

export async function runMoneyCommand(deps: {
  prisma: PrismaClient;
  paypal: PayPalPort;
  argv: string[];
  /** The NODE_ENV the script is running under. */
  env?: string;
}): Promise<CommandResult> {
  const { prisma, paypal } = deps;
  if ((deps.env ?? process.env.NODE_ENV) === "production") {
    return { lines: ["This script is for development only. It does not run in production."], exitCode: 1 };
  }

  const { words, flags } = parse(deps.argv);
  const [command, id, extra] = words;
  const pretend = flags.at ? new Date(flags.at) : undefined;
  if (pretend && Number.isNaN(pretend.getTime())) return fail(`"${flags.at}" is not a time. Try 2026-10-18T10:00:00Z.`);
  const now = () => pretend ?? new Date();

  // The live check does not exist yet, so "is it published?" is answered from what `published` recorded.
  const money: Money = createMoney({
    prisma,
    paypal,
    now,
    posts: { publishedAt: async (deliverableId) => (await money.view(deliverableId))?.publishedAt ?? null },
  });

  /** Prints how the money stands after a step, or why the step was refused. */
  const after = async (step: Promise<{ ok: true } | { ok: false; reason: string }>, deliverableId: string) => {
    const done = await step;
    if (!done.ok) return fail(`Refused: ${done.reason}`);
    const view = await money.view(deliverableId);
    return view ? ok(describe(view)) : fail("Refused: unknown_deliverable");
  };

  if (command === "jobs") {
    const ran = await runDueJobs(prisma, money.handlers, { now: now() });
    return ok([`Ran ${ran} job${ran === 1 ? "" : "s"}.`]);
  }
  if (command === "list") {
    const rows = await prisma.deliverableMoney.findMany({ orderBy: { createdAt: "asc" } });
    return ok(rows.length ? rows.map((row) => `${row.deliverableId}  ${row.stage}  ${dollars(row.amountCents)}`) : ["No deliverables yet."]);
  }
  if (command === "new") {
    const amountCents = cents(words[1] ?? "20");
    if (amountCents === undefined) return fail("Give the amount in dollars, like 20 or 1200.50.");
    const deadlineDays = Number(flags.days ?? 14);
    if (!Number.isInteger(deadlineDays) || deadlineDays < 1) return fail("Give --days as a whole number of days.");
    const deliverableId = `sbx-${crypto.randomUUID().slice(0, 6)}`;
    await money.open({
      deliverableId,
      amountCents,
      deadlineDays,
      creatorTimeZone: "UTC",
      payoutEmail: flags.email ?? DEFAULT_PAYOUT_EMAIL,
    });
    await money.brandAgreed(deliverableId);
    const started = await money.startHold(deliverableId);
    if (!started.ok) return fail(`Deliverable ${deliverableId} was made, but its hold was refused: ${started.reason}`);
    return ok([
      `Deliverable ${deliverableId}: ${dollars(amountCents)}, to be posted within ${deadlineDays} days of the hold.`,
      ...approveNext(deliverableId, started.approveUrl),
    ]);
  }

  if (!command || !id) return { lines: USAGE, exitCode: 1 };
  switch (command) {
    case "show": {
      const view = await money.view(id);
      if (!view) return fail("Refused: unknown_deliverable");
      const record = await prisma.moneyRecord.findMany({ where: { deliverableId: id }, orderBy: { id: "asc" } });
      return ok([
        ...describe(view),
        "",
        "Money record:",
        ...record.map((entry) => `  ${time(entry.at)}  ${entry.kind}:${entry.name}  (${entry.cause})${entry.reference ? `  ${entry.reference}` : ""}`),
      ]);
    }
    case "hold": {
      const started = await money.startHold(id);
      return started.ok ? ok(approveNext(id, started.approveUrl)) : fail(`Refused: ${started.reason}`);
    }
    case "approved":
    case "closed": {
      // The order the hold is waiting on is the last one PayPal created for this deliverable.
      const order = await prisma.payPalCall.findFirst({
        where: { deliverableId: id, purpose: "create_order", reference: { not: null } },
        orderBy: { startedAt: "desc" },
      });
      if (!order?.reference) return fail("There is no PayPal order for this deliverable. Start one with: new");
      return after(command === "approved" ? money.holdApproved(id, order.reference) : money.holdClosed(id, order.reference), id);
    }
    case "draft-cleared":
      return after(money.draftCleared(id), id);
    case "go-ahead":
      return after(money.askGoAhead(id), id);
    case "published":
      return after(money.postPublished(id, now()), id);
    case "live-check":
      if (extra !== "passed" && extra !== "cannot_decide" && extra !== "failed_fixable" && extra !== "failed_not_fixable") {
        return { lines: USAGE, exitCode: 1 };
      }
      return after(money.liveCheckResult(id, extra), id);
    case "confirm":
      return after(money.brandConfirmed(id), id);
    case "object":
      return after(money.brandObjected(id, "Objection made from the sandbox script."), id);
    case "accept":
      return after(money.brandAccepted(id), id);
    case "rule":
      if (extra !== "pay" && extra !== "release") return { lines: USAGE, exitCode: 1 };
      return after(money.clearedRuled(id, extra), id);
    case "cancel":
      if (extra !== "creator" && extra !== "brand") return { lines: USAGE, exitCode: 1 };
      return after(money.cancel(id, extra), id);
    case "payout-again":
      if (extra) await money.changePayoutEmail(id, extra);
      return after(money.payoutRetry(id), id);
    default:
      return { lines: USAGE, exitCode: 1 };
  }
}

/** What to do with a new approval link. Approve first: asking PayPal to hold an order nobody approved declines it. */
const approveNext = (deliverableId: string, approveUrl: string) => [
  "Approve the hold as a sandbox PERSONAL account (the brand):",
  "",
  `  ${approveUrl}`,
  "",
  `Only after approving, run: pnpm sandbox:money approved ${deliverableId}`,
];

const ok = (lines: string[]): CommandResult => ({ lines, exitCode: 0 });
const fail = (line: string): CommandResult => ({ lines: [line], exitCode: 1 });

/** Splits the words of a command from its `--name value` flags. */
function parse(argv: string[]): { words: string[]; flags: Record<string, string | undefined> } {
  const words: string[] = [];
  const flags: Record<string, string | undefined> = {};
  for (let index = 0; index < argv.length; index++) {
    const word = argv[index]!;
    if (word.startsWith("--")) flags[word.slice(2)] = argv[++index];
    else if (word) words.push(word);
  }
  return { words, flags };
}

/** "1200" or "1200.50" as whole cents, or undefined if it is not an amount in dollars. */
function cents(text: string): number | undefined {
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return undefined;
  const [whole = "0", fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function dollars(amountCents: number): string {
  const text = String(amountCents).padStart(3, "0");
  return `$${text.slice(0, -2)}.${text.slice(-2)}`;
}

const time = (moment: Date) => `${moment.toISOString().slice(0, 16).replace("T", " ")} UTC`;

/** How a deliverable's money stands, as lines to print. The creator's email is never among them (MP-BR-11). */
function describe(view: MoneyView): string[] {
  const lines = [`Stage: ${view.stage}`];
  const hold = view.hold;
  lines.push(
    hold.state === "held"
      ? `Hold: held, PayPal ref ${hold.reference}, post by ${time(hold.deadlineAt)}`
      : `Hold: ${hold.state}${hold.state === "declined" ? " (PayPal did not hold it. If it was not approved first, start again with: hold <id>)" : ""}`,
  );
  if (view.goAhead.state !== "none") {
    lines.push(`Go-ahead: ${view.goAhead.state}${"until" in view.goAhead ? ` until ${time(view.goAhead.until)}` : ""}`);
  }
  if (view.publishedAt) lines.push(`Published: ${time(view.publishedAt)}`);
  if (view.waitingOn) {
    lines.push(`Waiting on: ${view.waitingOn.for}${"until" in view.waitingOn ? ` until ${time(view.waitingOn.until)}` : ""}`);
  }
  if (view.approval) lines.push(`Approved to pay by: ${view.approval.by}`);
  if (view.capture) lines.push(`Capture: ${view.capture.status}${view.capture.reference ? `, PayPal ref ${view.capture.reference}` : ""}`);
  if (view.feeCents !== null && view.payoutCents !== null) {
    lines.push(`Fee: ${dollars(view.feeCents)}   Creator's payout: ${dollars(view.payoutCents)}`);
  }
  if (view.payout) {
    lines.push(`Payout: ${view.payout.status}${view.payout.why ? ` (${view.payout.why})` : ""}${view.payout.reference ? `, PayPal ref ${view.payout.reference}` : ""}`);
  }
  if (view.release) {
    const { reason, by, confirmedAt } = view.release;
    lines.push(`Released: ${reason}${by ? ` by the ${by}` : ""}${confirmedAt ? ", confirmed by PayPal" : ", not yet confirmed by PayPal"}`);
  }
  return lines;
}
