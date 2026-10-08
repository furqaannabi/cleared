/**
 * The money module (money path spec, "One money module"). Every change to a deliverable's money goes
 * through here: it ties the transition rules to Postgres, the jobs table and the PayPal port.
 *
 * Around every PayPal call (MP-BR-07): the deliverable's row is locked, the rules decide, and the call is
 * recorded as started, all in one transaction. PayPal is then called with no transaction open. The answer,
 * the change it causes and any job that follows are recorded together in a second transaction. A crash in
 * between leaves a started call, which is followed up.
 *
 * Built so far: opening a deliverable's money, the brand agreeing, starting a hold and its approval.
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { enqueue } from "../jobs/jobs";
import type { CreateOrderResult, PayPalPort } from "../paypal/port";
import { decodeState, encodeState } from "./codec";
import {
  defaultSettings,
  newMoney,
  transition,
  type MoneyEffect,
  type MoneyEvent,
  type MoneySettings,
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

/** The effects that are a call to PayPal, made after the transaction that recorded them. */
type PayPalEffect = Extract<MoneyEffect, { type: "create_order" | "authorize_order" }>;

interface StartedCall {
  effect: PayPalEffect;
  callId: string;
  requestId: string;
}

type Ran = { effect: Extract<PayPalEffect, { type: "create_order" }>; answer: CreateOrderResult } | { effect: PayPalEffect };

/** How long after an unclear answer PayPal is first asked again. */
const CHECK_AFTER_SECONDS = 60;

/** The parts of an event kept in the money record: ids and outcomes, never free text (MP-BR-11, MP-BR-13). */
const RECORDED = ["attemptId", "orderId", "confirmId", "captureId", "payoutId", "outcome", "result", "decision", "by"] as const;

export type Money = ReturnType<typeof createMoney>;

export function createMoney(deps: MoneyDeps) {
  const { prisma, paypal } = deps;
  const now = deps.now ?? (() => new Date());
  const settings = deps.settings ?? defaultSettings;
  const newId = deps.newId ?? (() => crypto.randomUUID());

  /**
   * Applies one event to a deliverable's money in one transaction, then makes the PayPal calls it asked
   * for. `settle` marks the call this event answers as settled, in the same transaction.
   */
  async function dispatch(
    deliverableId: string,
    event: MoneyEvent,
    cause: Cause,
    settle?: { callId: string; reference?: string },
  ): Promise<{ ok: true; ran: Ran[] } | Refused> {
    const outcome = await prisma.$transaction(async (tx): Promise<{ ok: true; started: StartedCall[] } | Refused> => {
      const [row] = await tx.$queryRaw<{ state: unknown }[]>`
        SELECT "state" FROM "DeliverableMoney" WHERE "deliverableId" = ${deliverableId} FOR UPDATE`;
      if (!row) return { ok: false, reason: "unknown_deliverable" };
      // PayPal's answer is final whatever the rules make of it, so the call is settled either way.
      if (settle) {
        await tx.payPalCall.update({
          where: { id: settle.callId },
          data: { status: "settled", reference: settle.reference, settledAt: event.at },
        });
      }
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

      const started: StartedCall[] = [];
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
            await enqueue(tx, {
              name: "check_attempt",
              payload: { deliverableId, attemptId: effect.attemptId },
              runAt: new Date(event.at.getTime() + CHECK_AFTER_SECONDS * 1000),
            });
            break;
          case "create_order":
          case "authorize_order": {
            // One call per purpose and attempt: asked again, it is the same call with the same request id.
            const key = { deliverableId, purpose: effect.type, subjectId: effect.attemptId };
            const call = await tx.payPalCall.upsert({
              where: { deliverableId_purpose_subjectId: key },
              create: { ...key, startedAt: event.at },
              update: {},
            });
            await record({ kind: "paypal_call", name: effect.type });
            started.push({ effect, callId: call.id, requestId: call.requestId });
            break;
          }
          default:
            // Thrown inside the transaction, so nothing of this change is kept.
            throw new Error(`The money module cannot carry out "${effect.type}" yet`);
        }
      }
      return { ok: true, started };
    });
    if (!outcome.ok) return outcome;

    const ran: Ran[] = [];
    for (const call of outcome.started) ran.push(await run(deliverableId, call));
    return { ok: true, ran };
  }

  /** Makes one PayPal call, with no transaction open, and applies its answer. */
  async function run(deliverableId: string, { effect, callId, requestId }: StartedCall): Promise<Ran> {
    switch (effect.type) {
      case "create_order": {
        const answer = await paypal.createOrder({ requestId, deliverableId, amountCents: effect.amountCents });
        if (answer.outcome === "created") {
          await dispatch(
            deliverableId,
            { type: "order_created", attemptId: effect.attemptId, orderId: answer.orderId, at: now() },
            "paypal",
            { callId, reference: answer.orderId },
          );
        }
        return { effect, answer };
      }
      case "authorize_order": {
        const answer = await paypal.authorizeOrder({ requestId, orderId: effect.orderId });
        const at = now();
        if (answer.outcome === "held") {
          await dispatch(
            deliverableId,
            { type: "authorize_answered", attemptId: effect.attemptId, outcome: "held", reference: answer.reference, at },
            "paypal",
            { callId, reference: answer.reference },
          );
        } else {
          // Declined is final. Pending and unknown leave the call started, to be followed up (MP-FR-06).
          await dispatch(
            deliverableId,
            { type: "authorize_answered", attemptId: effect.attemptId, outcome: answer.outcome, at },
            "paypal",
            answer.outcome === "declined" ? { callId } : undefined,
          );
        }
        return { effect };
      }
    }
  }

  async function view(deliverableId: string): Promise<MoneyView | undefined> {
    const row = await prisma.deliverableMoney.findUnique({ where: { deliverableId }, select: { state: true } });
    return row ? moneyView(decodeState(row.state)) : undefined;
  }

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
      for (const made of done.ran) {
        if ("answer" in made && made.answer.outcome === "created") {
          return { ok: true, orderId: made.answer.orderId, approveUrl: made.answer.approveUrl };
        }
      }
      // PayPal did not clearly create the order. The call stays started and is followed up; no link is given.
      return { ok: false, reason: "paypal_unclear" };
    },

    /** The brand approved the order in PayPal: hold the money, and say how the hold stands (MP-FR-03 to MP-FR-06). */
    async holdApproved(deliverableId: string, orderId: string): Promise<{ ok: true; hold: HoldView } | Refused> {
      const done = await dispatch(deliverableId, { type: "hold_approved", orderId, at: now() }, "call");
      if (!done.ok) return done;
      const after = await view(deliverableId);
      return after ? { ok: true, hold: after.hold } : { ok: false, reason: "unknown_deliverable" };
    },

    view,
  };
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
