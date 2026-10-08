/**
 * The money module (money path spec, "One money module"). Every change to a deliverable's money goes
 * through here: it ties the transition rules to Postgres, the jobs table and the PayPal port.
 *
 * Around every PayPal call (MP-BR-07): the deliverable's row is locked, the rules decide, and the call is
 * recorded as started with a job to follow it up, all in one transaction. PayPal is then called with no
 * transaction open. The answer, the change it causes and any job that follows are recorded together in a
 * second transaction. A crash in between leaves a started call, and its follow-up job finishes it.
 *
 * Built so far: opening a deliverable's money, the brand agreeing, and the whole hold step
 * (MP-FR-01 to MP-FR-08), with the follow-up of calls PayPal did not clearly answer (MP-FR-38).
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { enqueue, type JobHandlers } from "../jobs/jobs";
import type { AuthorizeResult, PayPalPort } from "../paypal/port";
import { decodeState, encodeState } from "./codec";
import { awaitingPayPal } from "./outcomes";
import {
  defaultSettings,
  newMoney,
  transition,
  type MoneyEffect,
  type MoneyEvent,
  type MoneySettings,
  type MoneyState,
  type MoneyTerms,
  type Refusal,
} from "./transition";
import { moneyView, type HoldView, type MoneyView } from "./view";

export interface MoneyDeps {
  prisma: PrismaClient;
  paypal: PayPalPort;
  /** The clock. Passed in so the module has none of its own. */
  now?: () => Date;
  settings?: MoneySettings;
  /** Makes ids for attempts, captures, payouts and confirmations. */
  newId?: () => string;
}

/** Why the module would not do something: one of the rules' reasons, or one of its own. */
export type MoneyRefusal = Refusal | "unknown_deliverable" | "paypal_unclear";

export type Refused = { ok: false; reason: MoneyRefusal };

/** What caused a change: a function call, a job falling due, a webhook, or PayPal's answer to a call. */
type Cause = "call" | "job" | "webhook" | "paypal";

/** The effects that are something asked of PayPal, done after the transaction that recorded them. */
type PayPalEffect = Extract<MoneyEffect, { type: "create_order" | "authorize_order" | "cancel_attempt" }>;

/** One thing asked of PayPal, as recorded: what it is for, which attempt, and the request id it is sent under. */
interface Call {
  id: string;
  deliverableId: string;
  purpose: string;
  subjectId: string;
  requestId: string;
  reference: string | null;
}

/** How one try at a call ended. `open` means PayPal has not settled it and it must be tried again. */
interface Tried {
  open: boolean;
  order?: { orderId: string; approveUrl: string };
}

const SETTLED: Tried = { open: false };
const OPEN: Tried = { open: true };

/** How long after a call is recorded its follow-up first runs, and the longest it waits between tries. */
const FOLLOW_UP_AFTER_SECONDS = 60;
const FOLLOW_UP_LONGEST_SECONDS = 3600;
/** How long the never-held job waits for an attempt PayPal has not answered (it settles within MP-FR-07's limit). */
const NEVER_HELD_WAIT_SECONDS = 3600;

/** The parts of an event kept in the money record: ids and outcomes, never free text (MP-BR-11, MP-BR-13). */
const RECORDED = ["attemptId", "orderId", "confirmId", "captureId", "payoutId", "outcome", "result", "decision", "by"] as const;

const secondsAfter = (from: Date, seconds: number) => new Date(from.getTime() + seconds * 1000);

export type Money = ReturnType<typeof createMoney>;

export function createMoney(deps: MoneyDeps) {
  const { prisma, paypal } = deps;
  const now = deps.now ?? (() => new Date());
  const settings = deps.settings ?? defaultSettings;
  const newId = deps.newId ?? (() => crypto.randomUUID());

  /**
   * Applies one event to a deliverable's money in one transaction, and returns the PayPal calls it
   * recorded as started. `settle` marks the call this event answers as settled, in the same transaction.
   */
  async function apply(
    deliverableId: string,
    event: MoneyEvent,
    cause: Cause,
    settle?: { callId: string; reference?: string },
  ): Promise<{ ok: true; started: Call[] } | Refused> {
    return prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<{ state: unknown }[]>`
        SELECT "state" FROM "DeliverableMoney" WHERE "deliverableId" = ${deliverableId} FOR UPDATE`;
      if (!row) return { ok: false, reason: "unknown_deliverable" };
      // PayPal's answer is final whatever the rules make of it, so the call is settled either way.
      if (settle) await settleCall(tx, settle.callId, event.at, settle.reference);
      const before = decodeState(row.state);
      const result = transition(before, event, settings);
      if (!result.ok) return result;
      if (result.state === before && result.effects.length === 0) return { ok: true, started: [] };

      const stage = result.state.stage;
      await tx.deliverableMoney.update({
        where: { deliverableId },
        data: { state: encodeState(result.state), stage, version: { increment: 1 } },
      });
      const record = (entry: { kind: string; name: string; reference?: string; details?: Prisma.InputJsonObject }) =>
        tx.moneyRecord.create({ data: { deliverableId, at: event.at, cause, stage, ...entry } });
      await record({ kind: "event", name: event.type, reference: referenceOf(event), details: detailsOf(event) });

      const started: Call[] = [];
      for (const effect of result.effects) {
        switch (effect.type) {
          case "schedule_job": {
            const { type: _type, job, at, ...ids } = effect;
            await enqueue(tx, { name: job, payload: { deliverableId, ...ids }, runAt: at });
            break;
          }
          case "notify":
            await record({ kind: "notice", name: effect.about, details: { to: effect.to } });
            break;
          case "check_attempt":
            // Nothing to add: the call that got no clear answer is still started, and its follow-up job keeps asking.
            break;
          case "create_order":
          case "authorize_order":
          case "cancel_attempt":
            started.push(await startCall(tx, deliverableId, effect, event.at));
            await record({ kind: "paypal_call", name: effect.type });
            break;
          default:
            // Thrown inside the transaction, so nothing of this change is kept.
            throw new Error(`The money module cannot carry out "${effect.type}" yet`);
        }
      }
      return { ok: true, started };
    });
  }

  /**
   * Records a call as started, with the job that follows it up, in the transaction that decided it. One
   * call per purpose and attempt: asked again, it is the same call with the same request id (MP-BR-06).
   */
  async function startCall(tx: Prisma.TransactionClient, deliverableId: string, effect: PayPalEffect, at: Date): Promise<Call> {
    const key = { deliverableId, purpose: effect.type, subjectId: effect.attemptId };
    // A cancellation is about an order that already exists, so the call keeps which one.
    const about = effect.type === "cancel_attempt" ? effect.orderId : undefined;
    const call = await tx.payPalCall.upsert({
      where: { deliverableId_purpose_subjectId: key },
      create: { ...key, reference: about, startedAt: at },
      update: {},
    });
    await enqueue(tx, {
      name: "follow_up",
      payload: { deliverableId, callId: call.id },
      runAt: secondsAfter(at, FOLLOW_UP_AFTER_SECONDS),
    });
    return call;
  }

  async function settleCall(db: Prisma.TransactionClient | PrismaClient, callId: string, at: Date, reference?: string) {
    await db.payPalCall.update({ where: { id: callId }, data: { status: "settled", reference, settledAt: at } });
  }

  /** Applies an event, then makes the PayPal calls it asked for. */
  async function dispatch(deliverableId: string, event: MoneyEvent, cause: Cause): Promise<{ ok: true; tried: Tried[] } | Refused> {
    const applied = await apply(deliverableId, event, cause);
    if (!applied.ok) return applied;
    const tried: Tried[] = [];
    for (const call of applied.started) tried.push(await attempt(call, false));
    return { ok: true, tried };
  }

  /** Applies PayPal's answer to a call, settling the call in the same transaction, and carries on from it. */
  async function answered(call: Call, event: MoneyEvent, reference?: string): Promise<void> {
    const applied = await apply(call.deliverableId, event, "paypal", { callId: call.id, reference });
    if (!applied.ok) return;
    for (const next of applied.started) await attempt(next, false);
  }

  async function readState(deliverableId: string): Promise<MoneyState | undefined> {
    const row = await prisma.deliverableMoney.findUnique({ where: { deliverableId }, select: { state: true } });
    return row ? decodeState(row.state) : undefined;
  }

  /**
   * Makes one try at a call, with no transaction open. The recorded state is read first, and PayPal is
   * not asked for anything nothing is waiting on any more (CLAUDE.md, "Money"). `followingUp` is false for
   * the try made straight after the call was recorded, and true for every later one.
   */
  async function attempt(call: Call, followingUp: boolean): Promise<Tried> {
    const state = await readState(call.deliverableId);
    if (!state) return SETTLED;
    const current = state.attempt?.id === call.subjectId ? state.attempt : undefined;

    switch (call.purpose) {
      case "create_order": {
        if (current?.status !== "creating") return abandon(call);
        const answer = await paypal.createOrder({
          requestId: call.requestId,
          deliverableId: call.deliverableId,
          amountCents: state.amountCents,
        });
        if (answer.outcome !== "created") return OPEN;
        await answered(
          call,
          { type: "order_created", attemptId: call.subjectId, orderId: answer.orderId, at: now() },
          answer.orderId,
        );
        return { open: false, order: { orderId: answer.orderId, approveUrl: answer.approveUrl } };
      }

      case "authorize_order": {
        if (!current || !awaitingPayPal(current) || !current.orderId) return abandon(call);
        const answer = await holdAnswer(call, current.orderId, followingUp);
        if (answer.outcome === "held") {
          await answered(
            call,
            { type: "authorize_answered", attemptId: call.subjectId, outcome: "held", reference: answer.reference, at: now() },
            answer.reference,
          );
          return SETTLED;
        }
        if (answer.outcome === "declined") {
          await answered(call, { type: "authorize_answered", attemptId: call.subjectId, outcome: "declined", at: now() });
          return SETTLED;
        }
        // Pending or unknown: the call stays started. The attempt is marked so the brand's page can say which.
        if (current.status !== answer.outcome) {
          await apply(call.deliverableId, { type: "authorize_answered", attemptId: call.subjectId, outcome: answer.outcome, at: now() }, "paypal");
        }
        return OPEN;
      }

      case "cancel_attempt": {
        // The attempt was given up, but PayPal may still hold the money for it, or may yet.
        if (!call.reference) return abandon(call);
        const order = await paypal.readOrder(call.reference);
        if (order.outcome === "pending" || order.outcome === "unknown") return OPEN;
        if (order.outcome === "held") {
          const cancelled = await paypal.cancelHold(order.reference);
          if (cancelled === "unknown") return OPEN;
        }
        await settleCall(prisma, call.id, now(), call.reference);
        return SETTLED;
      }

      default:
        throw new Error(`The money module cannot follow up "${call.purpose}" yet`);
    }
  }

  /**
   * What PayPal says of a hold. The first try asks for the hold. A later one reads the order first, and
   * only if PayPal never held anything on it sends the same request again, under the same request id.
   */
  async function holdAnswer(call: Call, orderId: string, followingUp: boolean): Promise<AuthorizeResult> {
    if (followingUp) {
      const order = await paypal.readOrder(orderId);
      if (order.outcome !== "not_held") return order;
    }
    return paypal.authorizeOrder({ requestId: call.requestId, orderId });
  }

  /** Settles a call nothing is waiting on any more, without asking PayPal. */
  async function abandon(call: Call): Promise<Tried> {
    await settleCall(prisma, call.id, now(), call.reference ?? undefined);
    return SETTLED;
  }

  async function view(deliverableId: string): Promise<MoneyView | undefined> {
    const state = await readState(deliverableId);
    return state ? moneyView(state) : undefined;
  }

  async function holdNow(deliverableId: string): Promise<{ ok: true; hold: HoldView } | Refused> {
    const after = await view(deliverableId);
    return after ? { ok: true, hold: after.hold } : { ok: false, reason: "unknown_deliverable" };
  }

  /** The jobs the money path schedules. Each may run more than once, so each goes through the rules again. */
  const handlers: JobHandlers = {
    /** A PayPal call that may not have been answered (MP-FR-38). */
    async follow_up(payload, { attempts }) {
      const { callId } = ids(payload, "callId");
      const call = await prisma.payPalCall.findUnique({ where: { id: callId } });
      if (!call || call.status === "settled") return;
      const tried = await attempt(call, true);
      if (!tried.open) return;
      // Asked again later, waiting twice as long each time, up to the longest wait.
      const wait = Math.min(FOLLOW_UP_AFTER_SECONDS * 2 ** (attempts - 1), FOLLOW_UP_LONGEST_SECONDS);
      return { retryAt: secondsAfter(now(), wait) };
    },

    /** An approved attempt PayPal has not answered for 24 hours (MP-FR-07). */
    async attempt_stuck(payload) {
      const { deliverableId, attemptId } = ids(payload, "deliverableId", "attemptId");
      await dispatch(deliverableId, { type: "attempt_stuck_due", attemptId, at: now() }, "job");
    },

    /** Seven days after the brand agreed (MP-FR-08). */
    async never_held(payload) {
      const { deliverableId } = ids(payload, "deliverableId");
      const done = await dispatch(deliverableId, { type: "never_held_due", at: now() }, "job");
      if (!done.ok && done.reason === "attempt_in_progress") {
        return { retryAt: secondsAfter(now(), NEVER_HELD_WAIT_SECONDS) };
      }
    },
  };

  return {
    /** Makes a deliverable's money, before the brand has agreed anything. */
    async open(input: MoneyTerms & { deliverableId: string; payoutEmail: string }): Promise<void> {
      const { deliverableId, payoutEmail, ...terms } = input;
      const state = newMoney(terms);
      await prisma.deliverableMoney.create({
        data: { deliverableId, payoutEmail, state: encodeState(state), stage: state.stage, amountCents: state.amountCents },
      });
    },

    /** The brand agreed the terms. From now a hold can be started (MP-FR-01). */
    async brandAgreed(deliverableId: string): Promise<{ ok: true } | Refused> {
      const done = await dispatch(deliverableId, { type: "brand_agreed", at: now() }, "call");
      return done.ok ? { ok: true } : done;
    },

    /** Starts a hold: creates the PayPal order the brand approves (MP-FR-01, MP-FR-02). */
    async startHold(deliverableId: string): Promise<{ ok: true; orderId: string; approveUrl: string } | Refused> {
      const done = await dispatch(deliverableId, { type: "start_hold", attemptId: newId(), at: now() }, "call");
      if (!done.ok) return done;
      const order = done.tried.find((tried) => tried.order)?.order;
      // PayPal did not clearly create the order. The call stays started and is followed up; no link is given.
      return order ? { ok: true, ...order } : { ok: false, reason: "paypal_unclear" };
    },

    /** The brand approved the order in PayPal: hold the money, and say how the hold stands (MP-FR-03 to MP-FR-06). */
    async holdApproved(deliverableId: string, orderId: string): Promise<{ ok: true; hold: HoldView } | Refused> {
      const done = await dispatch(deliverableId, { type: "hold_approved", orderId, at: now() }, "call");
      return done.ok ? holdNow(deliverableId) : done;
    },

    /** The brand closed PayPal without approving. Nothing is held (MP-FR-05). */
    async holdClosed(deliverableId: string, orderId: string): Promise<{ ok: true; hold: HoldView } | Refused> {
      const done = await dispatch(deliverableId, { type: "hold_closed", orderId, at: now() }, "call");
      return done.ok ? holdNow(deliverableId) : done;
    },

    view,
    handlers,
  };
}

/** Reads the named ids out of a job's payload. A payload without them is an error, and the job fails. */
function ids<Name extends string>(payload: unknown, ...names: Name[]): Record<Name, string> {
  const found = {} as Record<Name, string>;
  for (const name of names) {
    const value = (payload as Record<string, unknown> | null)?.[name];
    if (typeof value !== "string") throw new Error(`A money job is missing its ${name}`);
    found[name] = value;
  }
  return found;
}

function referenceOf(event: MoneyEvent): string | undefined {
  return "reference" in event && typeof event.reference === "string" ? event.reference : undefined;
}

function detailsOf(event: MoneyEvent): Prisma.InputJsonObject | undefined {
  const details: Record<string, string> = {};
  for (const key of RECORDED) {
    const value = (event as Record<string, unknown>)[key];
    if (typeof value === "string") details[key] = value;
  }
  return Object.keys(details).length > 0 ? details : undefined;
}
