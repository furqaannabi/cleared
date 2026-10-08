/**
 * The money module (money path spec, "One money module"). Every change to a deliverable's money goes
 * through here: it ties the transition rules to Postgres, the jobs table and the PayPal port.
 *
 * Around every PayPal call (MP-BR-07): the deliverable's row is locked, the rules decide, and the call is
 * recorded as started with a job to follow it up, all in one transaction. PayPal is then called with no
 * transaction open. The answer, the change it causes and any job that follows are recorded together in a
 * second transaction. A crash in between leaves a started call, and its follow-up job finishes it.
 *
 * Not built here yet: the webhook route (MP-FR-35 to MP-FR-37, MP-FR-39) and the full money view (MP-FR-40).
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { enqueue, type JobHandlers } from "../jobs/jobs";
import type { AuthorizeResult, PayPalPort } from "../paypal/port";
import { decodeState, encodeState } from "./codec";
import { awaitingPayPal } from "./outcomes";
import type { PublishedPostPort } from "./published-post";
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
import { moneyView, type GoAheadView, type HoldView, type MoneyView } from "./view";

export interface MoneyDeps {
  prisma: PrismaClient;
  paypal: PayPalPort;
  /** Whether a deliverable's approved post is published. The live check, once built. */
  posts: PublishedPostPort;
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
type PayPalEffect = Extract<
  MoneyEffect,
  {
    type:
      | "create_order"
      | "authorize_order"
      | "cancel_attempt"
      | "check_hold"
      | "renew_hold"
      | "capture_hold"
      | "cancel_hold"
      | "send_payout"
      | "cancel_payout";
  }
>;

/** What a call belongs to: a hold attempt, a request for the go-ahead, a capture, a payout, or a hold being given back. */
function subjectOf(effect: PayPalEffect): string {
  switch (effect.type) {
    case "create_order":
    case "authorize_order":
    case "cancel_attempt":
      return effect.attemptId;
    case "check_hold":
    case "renew_hold":
      return effect.confirmId;
    case "capture_hold":
      return effect.captureId;
    case "send_payout":
    case "cancel_payout":
      return effect.payoutId;
    case "cancel_hold":
      return effect.reference;
  }
}

/** The payout results that end a payout without paying. */
const ENDED_UNPAID = new Set(["failed", "returned", "blocked", "denied"]);

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
  const { prisma, paypal, posts } = deps;
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
      const first = transition(before, event, settings);
      if (!first.ok) return first;
      if (first.state === before && first.effects.length === 0) return { ok: true, started: [] };

      let state = first.state;
      const record = (entry: { kind: string; name: string; reference?: string; details?: Prisma.InputJsonObject }) =>
        tx.moneyRecord.create({ data: { deliverableId, at: event.at, cause, stage: state.stage, ...entry } });
      await record({ kind: "event", name: event.type, reference: referenceOf(event), details: detailsOf(event) });

      const effects = [...first.effects];
      /**
       * Applies a step that follows at once from the last one, in this same transaction: an approval and
       * the start of its capture, or a capture and the start of its payout, are recorded together.
       */
      const follow = async (next: MoneyEvent) => {
        const result = transition(state, next, settings);
        if (!result.ok) throw new Error(`"${next.type}" could not follow "${event.type}": ${result.reason}`);
        state = result.state;
        await record({ kind: "event", name: next.type, details: detailsOf(next) });
        effects.push(...result.effects);
      };

      const started: Call[] = [];
      for (let effect = effects.shift(); effect; effect = effects.shift()) {
        switch (effect.type) {
          case "schedule_job": {
            const { type: _type, job, at, ...ids } = effect;
            await enqueue(tx, { name: job, payload: { deliverableId, ...ids }, runAt: at });
            break;
          }
          case "notify":
            await record({ kind: "notice", name: effect.about, details: { to: effect.to } });
            break;
          case "start_capture":
            await follow({ type: "capture_started", captureId: newId(), at: event.at });
            break;
          case "start_payout":
            await follow({ type: "payout_started", payoutId: newId(), at: event.at });
            break;
          case "check_attempt":
          case "check_capture":
          case "check_payout":
          case "check_hold_cancelled":
            // Nothing to add: the call that got no clear answer is still started, and its follow-up job keeps asking.
            break;
          default:
            started.push(await startCall(tx, deliverableId, effect, event.at));
            await record({ kind: "paypal_call", name: effect.type });
        }
      }
      await tx.deliverableMoney.update({
        where: { deliverableId },
        data: { state: encodeState(state), stage: state.stage, version: { increment: 1 } },
      });
      return { ok: true, started };
    });
  }

  /**
   * Records a call as started, with the job that follows it up, in the transaction that decided it. One
   * call per purpose and attempt: asked again, it is the same call with the same request id (MP-BR-06).
   */
  async function startCall(tx: Prisma.TransactionClient, deliverableId: string, effect: PayPalEffect, at: Date): Promise<Call> {
    const key = { deliverableId, purpose: effect.type, subjectId: subjectOf(effect) };
    // A cancellation is about an order or a hold that already exists, so the call keeps which one.
    const about =
      effect.type === "cancel_attempt" ? effect.orderId : effect.type === "cancel_hold" ? effect.reference : undefined;
    const call = await tx.payPalCall.upsert({
      where: { deliverableId_purpose_subjectId: key },
      create: { ...key, reference: about, startedAt: at },
      // A payout PayPal would not send is the same call sent again, so it is opened again (MP-FR-45).
      update: effect.type === "send_payout" ? { status: "started", settledAt: null } : {},
    });
    if (effect.type === "capture_hold" && effect.renewFirst) {
      // The hold is re-confirmed before this capture (MP-FR-24). It is a call of its own, with its own
      // request id, followed up as part of the capture.
      const renewal = { deliverableId, purpose: "renew_for_capture", subjectId: effect.captureId };
      await tx.payPalCall.upsert({
        where: { deliverableId_purpose_subjectId: renewal },
        create: { ...renewal, startedAt: at },
        update: {},
      });
    }
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

      case "check_hold":
      case "renew_hold": {
        const asked = state.goAhead.status === "confirming" && state.goAhead.confirmId === call.subjectId;
        if (!asked || !state.hold) return abandon(call);
        const confirmId = call.subjectId;
        if (call.purpose === "check_hold") {
          const status = await paypal.readHold(state.hold.reference);
          if (status === "unknown") return OPEN;
          if (status === "in_place") {
            await answered(call, { type: "hold_confirmed", confirmId, at: now() }, state.hold.reference);
          } else {
            await answered(call, { type: "hold_not_confirmed", confirmId, at: now() });
          }
          return SETTLED;
        }
        // Sent again after an unclear answer, it goes under the same request id, so PayPal renews once.
        const renewed = await paypal.renewHold({
          requestId: call.requestId,
          reference: state.hold.reference,
          amountCents: state.amountCents,
        });
        if (renewed.outcome === "unknown") return OPEN;
        if (renewed.outcome === "renewed") {
          await answered(
            call,
            { type: "hold_confirmed", confirmId, renewedReference: renewed.reference, at: now() },
            renewed.reference,
          );
        } else {
          await answered(call, { type: "hold_not_confirmed", confirmId, at: now() });
        }
        return SETTLED;
      }

      case "capture_hold": {
        const capturing = state.capture?.id === call.subjectId && state.capture.status === "started";
        if (!capturing || !state.hold) return abandon(call);
        let reference = state.hold.reference;
        let renewedReference: string | undefined;
        const renewal = await findCall(call.deliverableId, "renew_for_capture", call.subjectId);
        if (renewal?.status === "started") {
          const renewed = await paypal.renewHold({ requestId: renewal.requestId, reference, amountCents: state.amountCents });
          if (renewed.outcome === "unknown") return OPEN;
          // Refused or not, the capture is still tried: PayPal may take the money without a renewal.
          renewedReference = renewed.outcome === "renewed" ? renewed.reference : undefined;
          await settleCall(prisma, renewal.id, now(), renewedReference);
        } else if (renewal?.reference) {
          // Renewed on an earlier try whose capture got no clear answer.
          renewedReference = renewal.reference;
        }
        reference = renewedReference ?? reference;
        const answer = await paypal.captureHold({ requestId: call.requestId, reference, amountCents: state.amountCents });
        if (answer.outcome === "unknown") return OPEN;
        const captureId = call.subjectId;
        if (answer.outcome === "completed") {
          await answered(
            call,
            { type: "capture_answered", captureId, outcome: "completed", reference: answer.reference, renewedReference, at: now() },
            answer.reference,
          );
        } else {
          await answered(call, { type: "capture_answered", captureId, outcome: "refused", renewedReference, at: now() });
        }
        return SETTLED;
      }

      case "cancel_hold": {
        if (!state.release || state.release.confirmedAt) return abandon(call);
        const outcome = await paypal.cancelHold(call.subjectId);
        if (outcome === "unknown") return OPEN;
        await answered(call, { type: "hold_cancel_answered", outcome, at: now() }, call.subjectId);
        return SETTLED;
      }

      case "send_payout": {
        const payoutId = call.subjectId;
        const payout = state.payout?.id === payoutId ? state.payout : undefined;
        if (!payout || !["sending", "unclaimed", "cancelling"].includes(payout.status)) return abandon(call);
        let reference = call.reference;
        if (!reference) {
          if (payout.status !== "sending" || state.payoutCents === null) return abandon(call);
          // The creator's email as it stands at this moment (MP-FR-28). It goes to PayPal and nowhere else.
          const row = await prisma.deliverableMoney.findUnique({
            where: { deliverableId: call.deliverableId },
            select: { payoutEmail: true },
          });
          if (!row) return SETTLED;
          const sent = await paypal.sendPayout({ requestId: call.requestId, email: row.payoutEmail, amountCents: state.payoutCents });
          if (sent.outcome === "unknown") return OPEN;
          if (sent.outcome === "refused") {
            await answered(call, { type: "payout_answered", payoutId, outcome: "refused", at: now() });
            return SETTLED;
          }
          // Accepted is not paid. The call stays started, with the payout's reference, until PayPal reports a result.
          reference = sent.payoutReference;
          await prisma.payPalCall.update({ where: { id: call.id }, data: { reference } });
          if (!followingUp) return OPEN;
        }
        const status = await paypal.readPayout(reference);
        if (status.outcome === "succeeded") {
          await answered(call, { type: "payout_answered", payoutId, outcome: "succeeded", reference: status.reference, at: now() });
          return SETTLED;
        }
        if (status.outcome === "unclaimed") {
          if (payout.status === "sending") {
            await apply(call.deliverableId, { type: "payout_answered", payoutId, outcome: "unclaimed", at: now() }, "paypal");
          }
          // Still open: the creator may yet accept it, or PayPal may return it.
          return OPEN;
        }
        if (ENDED_UNPAID.has(status.outcome)) {
          // While it is being cancelled, the cancellation's own answer decides what happens next.
          if (payout.status === "cancelling") return OPEN;
          await answered(call, {
            type: "payout_answered",
            payoutId,
            outcome: status.outcome as "failed" | "returned" | "blocked" | "denied",
            at: now(),
          });
          return SETTLED;
        }
        return OPEN;
      }

      case "cancel_payout": {
        const payoutId = call.subjectId;
        if (state.payout?.id !== payoutId || state.payout.status !== "cancelling") return abandon(call);
        const sending = await findCall(call.deliverableId, "send_payout", payoutId);
        if (!sending?.reference) return abandon(call);
        const cancelled = await paypal.cancelPayout(sending.reference);
        if (cancelled.outcome === "unknown") return OPEN;
        if (cancelled.outcome === "not_cancellable") {
          // It is no longer unclaimed. If the creator accepted it, it is paid. If it came back by itself,
          // the money is with Cleared again, which is all a cancellation would have done.
          const status = await paypal.readPayout(sending.reference);
          if (status.outcome === "succeeded") {
            await answered(call, { type: "payout_answered", payoutId, outcome: "succeeded", reference: status.reference, at: now() });
            await settleCall(prisma, sending.id, now());
            return SETTLED;
          }
          if (!ENDED_UNPAID.has(status.outcome)) return OPEN;
        }
        await settleCall(prisma, sending.id, now());
        await answered(call, { type: "payout_answered", payoutId, outcome: "cancelled", at: now() });
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

  function findCall(deliverableId: string, purpose: string, subjectId: string) {
    return prisma.payPalCall.findUnique({
      where: { deliverableId_purpose_subjectId: { deliverableId, purpose, subjectId } },
    });
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

  /** Applies an event that someone asked for, and says how the money stands afterwards. */
  async function act(deliverableId: string, event: MoneyEvent): Promise<{ ok: true; money: MoneyView } | Refused> {
    const done = await dispatch(deliverableId, event, "call");
    if (!done.ok) return done;
    const money = await view(deliverableId);
    return money ? { ok: true, money } : { ok: false, reason: "unknown_deliverable" };
  }

  /** Runs a timer's event. A timer that finds nothing left to do is not an error. */
  const timer =
    (event: (now: Date) => MoneyEvent) =>
    async (payload: unknown): Promise<void> => {
      const { deliverableId } = ids(payload, "deliverableId");
      await dispatch(deliverableId, event(now()), "job");
    };

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

    /** A go-ahead's end time: it ends unless a post was published under it (MP-FR-15). */
    async go_ahead_ends(payload) {
      const { deliverableId } = ids(payload, "deliverableId");
      const publishedAt = await posts.publishedAt(deliverableId);
      await dispatch(deliverableId, { type: "go_ahead_ends_due", publishedAt, at: now() }, "job");
    },

    /** The brand's 48 hours to confirm a live post have passed: silence pays (MP-FR-18). */
    brand_confirm_ends: timer((at) => ({ type: "brand_confirm_ends_due", at })),

    /** The creator's time to fix a failed live post has passed (MP-FR-20). */
    fix_window_ends: timer((at) => ({ type: "fix_window_ends_due", at })),

    /** The brand's 48 hours to accept a failed post have passed: silence does not pay (MP-FR-21). */
    brand_accept_ends: timer((at) => ({ type: "brand_accept_ends_due", at })),

    /** The deadline: the hold is released unless an approved post was published in time (MP-FR-22). */
    async deadline(payload) {
      const { deliverableId } = ids(payload, "deliverableId");
      const publishedAt = await posts.publishedAt(deliverableId);
      await dispatch(deliverableId, { type: "deadline_due", publishedAt, at: now() }, "job");
    },

    /** Day 28: anything still undecided is released (MP-FR-23). It waits for a capture PayPal has not answered. */
    async day_28(payload) {
      const { deliverableId } = ids(payload, "deliverableId");
      const done = await dispatch(deliverableId, { type: "day_28_due", at: now() }, "job");
      if (!done.ok && done.reason === "capture_in_progress") {
        return { retryAt: secondsAfter(now(), NEVER_HELD_WAIT_SECONDS) };
      }
    },

    /** Six hours after PayPal refused a capture: a new try, under a new request id (MP-FR-25). */
    async capture_retry(payload) {
      const { deliverableId } = ids(payload, "deliverableId");
      await dispatch(deliverableId, { type: "capture_retry_due", captureId: newId(), at: now() }, "job");
    },

    /** Six hours after PayPal would not send a payout: the same payout again, under the same request id (MP-FR-45). */
    async payout_resend(payload) {
      const { deliverableId, payoutId } = ids(payload, "deliverableId", "payoutId");
      await dispatch(deliverableId, { type: "payout_resend_due", payoutId, at: now() }, "job");
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

    /** The draft is cleared to publish. Decided outside this module, and trusted (MP-FR-10). */
    async draftCleared(deliverableId: string): Promise<{ ok: true } | Refused> {
      const done = await dispatch(deliverableId, { type: "draft_cleared", at: now() }, "call");
      return done.ok ? { ok: true } : done;
    },

    /**
     * The creator asks to publish: re-confirm the hold with PayPal and say where they stand
     * (MP-FR-10 to MP-FR-14). A go-ahead already running, or being confirmed, is answered as it stands.
     */
    async askGoAhead(deliverableId: string): Promise<{ ok: true; goAhead: GoAheadView } | Refused> {
      const done = await dispatch(deliverableId, { type: "go_ahead_requested", confirmId: newId(), at: now() }, "call");
      if (!done.ok) return done;
      const after = await view(deliverableId);
      return after ? { ok: true, goAhead: after.goAhead } : { ok: false, reason: "unknown_deliverable" };
    },

    /** The live check reports the approved post published (MP-FR-16). */
    postPublished: (deliverableId: string, publishedAt: Date) =>
      act(deliverableId, { type: "post_published", publishedAt, at: now() }),

    /** The live check's result, decided by fixed code outside this module (MP-FR-17, MP-FR-18, MP-FR-20, MP-FR-21). */
    liveCheckResult: (deliverableId: string, result: "passed" | "cannot_decide" | "failed_fixable" | "failed_not_fixable") =>
      act(deliverableId, { type: "live_check_result", result, at: now() }),

    /** The brand confirms a live post the check could not decide on (MP-FR-18). */
    brandConfirmed: (deliverableId: string) => act(deliverableId, { type: "brand_confirmed", at: now() }),

    /** The brand objects to paying for a live post. The reason is untrusted text: stored, never acted on (MP-BR-13). */
    brandObjected: (deliverableId: string, reason: string) =>
      act(deliverableId, { type: "brand_objected", reason, at: now() }),

    /** The brand accepts a live post that failed on something that cannot be fixed (MP-FR-21). */
    brandAccepted: (deliverableId: string) => act(deliverableId, { type: "brand_accepted", at: now() }),

    /** A person at Cleared rules on a brand's objection (MP-FR-19). */
    clearedRuled: (deliverableId: string, decision: "pay" | "release") =>
      act(deliverableId, { type: "cleared_ruled", decision, at: now() }),

    /** The creator or the brand cancels (MP-FR-33, MP-FR-34). */
    cancel: (deliverableId: string, by: "creator" | "brand") =>
      act(deliverableId, { type: "cancel_requested", by, at: now() }),

    /** The creator asks for the payout to be sent again, after one ended unpaid (MP-FR-30). */
    payoutRetry: (deliverableId: string) =>
      act(deliverableId, { type: "payout_retry_requested", payoutId: newId(), at: now() }),

    /** The creator corrects their PayPal email. It is used by the next payout sent (MP-FR-28). */
    async changePayoutEmail(deliverableId: string, payoutEmail: string): Promise<void> {
      await prisma.deliverableMoney.update({ where: { deliverableId }, data: { payoutEmail } });
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
