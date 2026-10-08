/**
 * The sandbox script's commands (MP-FR-44), run here against the fake PayPal and the test database.
 * Against the real sandbox they are run by hand: `pnpm sandbox:money`.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { prisma } from "../src/db";
import { FakePayPal } from "../test/fake-paypal";
import { runMoneyCommand } from "./money-commands";

beforeEach(async () => {
  await prisma.moneyRecord.deleteMany();
  await prisma.payPalCall.deleteMany();
  await prisma.deliverableMoney.deleteMany();
  await prisma.job.deleteMany();
});

function setUp() {
  const paypal = new FakePayPal();
  /** Runs one command, as `pnpm sandbox:money <words>` would. */
  const run = async (words: string) => {
    const result = await runMoneyCommand({ prisma, paypal, argv: words.split(" ") });
    return { ...result, text: result.lines.join("\n") };
  };
  return { paypal, run };
}

/** The id of the one deliverable in the database, and the PayPal order its hold is waiting on. */
async function theDeliverable() {
  const row = await prisma.deliverableMoney.findFirstOrThrow();
  const order = await prisma.payPalCall.findFirstOrThrow({ where: { purpose: "create_order" }, orderBy: { startedAt: "desc" } });
  return { id: row.deliverableId, orderId: order.reference! };
}

describe("MP-FR-44 the sandbox script", () => {
  test("it refuses to run in production", async () => {
    const paypal = new FakePayPal();

    const result = await runMoneyCommand({ prisma, paypal, argv: ["new"], env: "production" });

    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("development only");
    expect(await prisma.deliverableMoney.count()).toBe(0);
    expect(paypal.calls).toEqual([]);
  });

  test("new: makes a test deliverable, starts its hold, and prints the approval link and what to run next", async () => {
    const { paypal, run } = setUp();

    const result = await run("new 1200 --at 2026-10-10T09:00:00Z");

    const { id } = await theDeliverable();
    expect(result.exitCode).toBe(0);
    expect(result.text).toContain(id);
    expect(result.text).toContain("https://paypal.test/approve/");
    expect(result.text).toContain(`approved ${id}`);
    expect(paypal.calls).toMatchObject([{ method: "createOrder", amountCents: 120_000 }]);
  });

  test("approved: holds the money once the brand has approved in PayPal", async () => {
    const { paypal, run } = setUp();
    await run("new 1200 --at 2026-10-10T09:00:00Z");
    const { id, orderId } = await theDeliverable();
    paypal.brandApproves(orderId);

    const result = await run(`approved ${id} --at 2026-10-10T09:05:00Z`);

    expect(result.exitCode).toBe(0);
    expect(result.text).toContain("held");
    expect(paypal.holds()).toMatchObject([{ amountCents: 120_000, status: "in_place" }]);
  });

  test("it walks a deliverable from the hold to paid, one command at a time", async () => {
    const { paypal, run } = setUp();
    await run("new 1200 --at 2026-10-10T09:00:00Z");
    const { id, orderId } = await theDeliverable();
    paypal.brandApproves(orderId);

    for (const step of [
      `approved ${id} --at 2026-10-10T09:05:00Z`,
      `draft-cleared ${id} --at 2026-10-10T12:00:00Z`,
      `go-ahead ${id} --at 2026-10-10T13:00:00Z`,
      `published ${id} --at 2026-10-11T09:30:00Z`,
      `live-check ${id} passed --at 2026-10-11T09:40:00Z`,
    ]) {
      const result = await run(step);
      expect({ step, exitCode: result.exitCode }).toEqual({ step, exitCode: 0 });
    }
    expect(paypal.capturedCents()).toBe(120_000);

    // PayPal reports the payout arrived; the next run of the jobs picks that up.
    paypal.payoutEnds(paypal.payouts()[0]!.payoutReference, "succeeded");
    await run("jobs --at 2026-10-11T09:45:00Z");

    const shown = await run(`show ${id}`);
    expect(shown.text).toContain("paid");
    expect(shown.text).toContain("$1140.00");
    // The money record is printed, in order.
    expect(shown.text.indexOf("start_hold")).toBeLessThan(shown.text.indexOf("capture_answered"));
  });

  test("hold: starts a hold again after one was closed or declined, with a new approval link", async () => {
    const { paypal, run } = setUp();
    await run("new 1200 --at 2026-10-10T09:00:00Z");
    const { id } = await theDeliverable();
    await run(`closed ${id} --at 2026-10-10T09:02:00Z`);

    const again = await run(`hold ${id} --at 2026-10-10T09:10:00Z`);

    expect(again.exitCode).toBe(0);
    expect(again.text).toContain("https://paypal.test/approve/");
    const { orderId } = await theDeliverable();
    paypal.brandApproves(orderId);
    expect((await run(`approved ${id} --at 2026-10-10T09:12:00Z`)).text).toContain("Hold: held");
  });

  test("a refusal is printed with its reason, and the command fails", async () => {
    const { paypal, run } = setUp();
    await run("new 1200 --at 2026-10-10T09:00:00Z");
    const { id, orderId } = await theDeliverable();
    paypal.brandApproves(orderId);
    await run(`approved ${id} --at 2026-10-10T09:05:00Z`);

    const result = await run(`go-ahead ${id} --at 2026-10-10T13:00:00Z`);

    expect(result.exitCode).toBe(1);
    expect(result.text).toContain("draft_not_cleared");
  });

  test("cancel and Cleared's ruling are commands too", async () => {
    const { paypal, run } = setUp();
    await run("new 1200 --at 2026-10-10T09:00:00Z");
    const { id, orderId } = await theDeliverable();
    paypal.brandApproves(orderId);
    await run(`approved ${id} --at 2026-10-10T09:05:00Z`);

    const result = await run(`cancel ${id} brand --at 2026-10-11T09:00:00Z`);

    expect(result.exitCode).toBe(0);
    expect(result.text).toContain("released");
    expect(paypal.holds()).toMatchObject([{ status: "ended" }]);
    expect((await run(`rule ${id} pay`)).exitCode).toBe(1);
  });

  test("the creator's PayPal email can be set, and is never printed", async () => {
    const { run } = setUp();

    const made = await run("new 20 --email someone@example.com --at 2026-10-10T09:00:00Z");
    const { id } = await theDeliverable();
    const shown = await run(`show ${id}`);

    expect((await prisma.deliverableMoney.findFirstOrThrow()).payoutEmail).toBe("someone@example.com");
    expect(made.text + shown.text).not.toContain("someone@example.com");
  });

  test("a command it does not know, or one missing its deliverable, prints what it can do", async () => {
    const { run } = setUp();

    const unknown = await run("dance");
    const missing = await run("approved");

    expect(unknown.exitCode).toBe(1);
    expect(unknown.text).toContain("new [dollars]");
    expect(missing.exitCode).toBe(1);
    expect((await run("show no_such_deliverable")).text).toContain("unknown_deliverable");
  });
});
