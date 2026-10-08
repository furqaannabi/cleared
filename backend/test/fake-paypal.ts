/**
 * A stand-in for PayPal, for tests only. It is never built into the service
 * (docs/decisions/2026-10-08-backend-test-tooling.md).
 *
 * It keeps PayPal's side of the money: orders, holds, captures and payouts. Left alone it says yes to
 * everything. A test tells it to misbehave once with `next()`, and plays the brand, PayPal's delayed
 * answers and PayPal's webhooks with the methods at the bottom.
 */
import type {
  AuthorizeResult,
  CancelHoldResult,
  CaptureResult,
  CreateOrderResult,
  HoldStatus,
  PayPalPort,
  PayoutStatus,
  RenewResult,
  SendPayoutResult,
} from "../src/paypal/port";

/**
 * How the next call to a method goes wrong.
 * timeout_before: PayPal never got the request. timeout_after: PayPal did the work and the answer was lost.
 */
type Misbehaviour = "declined" | "pending" | "refused" | "timeout_before" | "timeout_after";

type Method = "createOrder" | "authorizeOrder" | "renewHold" | "captureHold" | "sendPayout";

interface Order {
  amountCents: number;
  approved: boolean;
  status: "created" | "pending" | "held" | "declined";
  reference?: string;
}

interface FakeHold {
  reference: string;
  amountCents: number;
  status: Exclude<HoldStatus, "unknown">;
}

interface FakePayout {
  payoutReference: string;
  amountCents: number;
  status: PayoutStatus;
}

/** One call made to PayPal. It never holds the creator's email (MP-BR-11). */
export interface RecordedCall {
  method: string;
  requestId?: string;
  reference?: string;
  amountCents?: number;
}

export class FakePayPal implements PayPalPort {
  /** Every call made, in order. Tests assert exactly which calls reached PayPal. */
  readonly calls: RecordedCall[] = [];

  private readonly orders = new Map<string, Order>();
  private readonly holdsByReference = new Map<string, FakeHold>();
  private readonly payoutsByReference = new Map<string, FakePayout>();
  /** The first answer to each request id. Sending the id again returns it and does nothing more. */
  private readonly answers = new Map<string, unknown>();
  private readonly misbehaviours = new Map<Method, Misbehaviour[]>();
  private readonly sentWebhooks = new Map<string, string>();
  private captured = 0;
  private sequence = 0;

  // The port

  async createOrder(input: { requestId: string; deliverableId: string; amountCents: number }): Promise<CreateOrderResult> {
    this.calls.push({ method: "createOrder", requestId: input.requestId, amountCents: input.amountCents });
    return this.once("createOrder", input.requestId, () => {
      const orderId = this.id("ORDER");
      this.orders.set(orderId, { amountCents: input.amountCents, approved: false, status: "created" });
      return { outcome: "created", orderId, approveUrl: `https://paypal.test/approve/${orderId}` };
    });
  }

  async authorizeOrder(input: { requestId: string; orderId: string }): Promise<AuthorizeResult> {
    this.calls.push({ method: "authorizeOrder", requestId: input.requestId, reference: input.orderId });
    return this.once("authorizeOrder", input.requestId, (misbehaviour) => {
      const order = this.orders.get(input.orderId);
      if (!order?.approved) return { outcome: "declined" };
      if (misbehaviour === "declined") {
        order.status = "declined";
        return { outcome: "declined" };
      }
      if (misbehaviour === "pending") {
        order.status = "pending";
        return { outcome: "pending" };
      }
      return this.holdOrder(order);
    });
  }

  async readOrder(orderId: string): Promise<AuthorizeResult | { outcome: "not_held" }> {
    this.calls.push({ method: "readOrder", reference: orderId });
    const order = this.orders.get(orderId);
    if (!order || order.status === "created") return { outcome: "not_held" };
    if (order.status === "held" && order.reference) return { outcome: "held", reference: order.reference };
    return { outcome: order.status === "pending" ? "pending" : "declined" };
  }

  async readHold(reference: string): Promise<HoldStatus> {
    this.calls.push({ method: "readHold", reference });
    return this.holdsByReference.get(reference)?.status ?? "unknown";
  }

  async renewHold(input: { requestId: string; reference: string; amountCents: number }): Promise<RenewResult> {
    this.calls.push({ method: "renewHold", requestId: input.requestId, reference: input.reference });
    return this.once("renewHold", input.requestId, (misbehaviour) => {
      const old = this.holdsByReference.get(input.reference);
      if (!old || old.status !== "in_place" || misbehaviour === "refused") return { outcome: "refused" };
      // Stricter than PayPal may be: the old reference stops working, so a caller that keeps using it is caught.
      old.status = "ended";
      const renewed: FakeHold = { reference: this.id("AUTH"), amountCents: old.amountCents, status: "in_place" };
      this.holdsByReference.set(renewed.reference, renewed);
      return { outcome: "renewed", reference: renewed.reference };
    });
  }

  async captureHold(input: { requestId: string; reference: string; amountCents: number }): Promise<CaptureResult> {
    this.calls.push({
      method: "captureHold",
      requestId: input.requestId,
      reference: input.reference,
      amountCents: input.amountCents,
    });
    return this.once("captureHold", input.requestId, (misbehaviour) => {
      const hold = this.holdsByReference.get(input.reference);
      if (!hold || hold.status !== "in_place" || input.amountCents > hold.amountCents || misbehaviour === "refused") {
        return { outcome: "refused" };
      }
      hold.status = "captured";
      this.captured += input.amountCents;
      return { outcome: "completed", reference: this.id("CAPTURE") };
    });
  }

  async cancelHold(reference: string): Promise<CancelHoldResult> {
    this.calls.push({ method: "cancelHold", reference });
    const hold = this.holdsByReference.get(reference);
    if (!hold || hold.status === "captured") return "failed";
    if (hold.status === "ended") return "already_ended";
    hold.status = "ended";
    return "cancelled";
  }

  async sendPayout(input: { requestId: string; email: string; amountCents: number }): Promise<SendPayoutResult> {
    this.calls.push({ method: "sendPayout", requestId: input.requestId, amountCents: input.amountCents });
    return this.once("sendPayout", input.requestId, () => {
      const payoutReference = this.id("PAYOUT");
      this.payoutsByReference.set(payoutReference, {
        payoutReference,
        amountCents: input.amountCents,
        status: { outcome: "pending" },
      });
      return { outcome: "accepted", payoutReference };
    });
  }

  async readPayout(payoutReference: string): Promise<PayoutStatus> {
    this.calls.push({ method: "readPayout", reference: payoutReference });
    return this.payoutsByReference.get(payoutReference)?.status ?? { outcome: "unknown" };
  }

  async cancelPayout(payoutReference: string): Promise<{ outcome: "cancelled" | "not_cancellable" | "unknown" }> {
    this.calls.push({ method: "cancelPayout", reference: payoutReference });
    const payout = this.payoutsByReference.get(payoutReference);
    if (payout?.status.outcome !== "unclaimed") return { outcome: "not_cancellable" };
    payout.status = { outcome: "cancelled" };
    return { outcome: "cancelled" };
  }

  async verifyWebhook(input: { headers: Record<string, string>; body: string }): Promise<boolean> {
    const signature = input.headers["paypal-transmission-sig"];
    return signature !== undefined && this.sentWebhooks.get(signature) === input.body;
  }

  // What a test controls

  /** Makes the next call to `method` go wrong, once. */
  next(method: Method, misbehaviour: Misbehaviour): void {
    this.misbehaviours.set(method, [...(this.misbehaviours.get(method) ?? []), misbehaviour]);
  }

  /** The brand approves the order in PayPal's window. */
  brandApproves(orderId: string): void {
    const order = this.orders.get(orderId);
    if (order) order.approved = true;
  }

  /** PayPal finishes reviewing an order it had answered "pending" for. */
  settlePending(orderId: string, result: "held" | "declined"): void {
    const order = this.orders.get(orderId);
    if (order?.status !== "pending") throw new Error(`Order ${orderId} is not pending`);
    if (result === "held") this.holdOrder(order);
    else order.status = "declined";
  }

  /** PayPal reports how a payout ended. */
  payoutEnds(
    payoutReference: string,
    result: "succeeded" | "unclaimed" | "failed" | "returned" | "blocked" | "denied",
  ): void {
    const payout = this.payoutsByReference.get(payoutReference);
    if (!payout) throw new Error(`No payout ${payoutReference}`);
    payout.status = result === "succeeded" ? { outcome: "succeeded", reference: this.id("PAYOUT-ITEM") } : { outcome: result };
  }

  /** An event as PayPal would deliver it: a body and the headers that prove PayPal sent it. */
  webhook(event: { id: string; event_type: string; resource?: unknown }): { headers: Record<string, string>; body: string } {
    const body = JSON.stringify(event);
    const signature = this.id("SIG");
    this.sentWebhooks.set(signature, body);
    return { headers: { "paypal-transmission-id": event.id, "paypal-transmission-sig": signature }, body };
  }

  // What a test can check

  /** Every hold PayPal has made, with what became of it. */
  holds(): FakeHold[] {
    return [...this.holdsByReference.values()];
  }

  payouts(): FakePayout[] {
    return [...this.payoutsByReference.values()];
  }

  /** The total taken from brands. */
  capturedCents(): number {
    return this.captured;
  }

  /** The total that has reached creators. */
  paidOutCents(): number {
    return this.payouts()
      .filter((payout) => payout.status.outcome === "succeeded")
      .reduce((sum, payout) => sum + payout.amountCents, 0);
  }

  // Inside

  private id(prefix: string): string {
    return `${prefix}-${++this.sequence}`;
  }

  private holdOrder(order: Order): AuthorizeResult {
    const hold: FakeHold = { reference: this.id("AUTH"), amountCents: order.amountCents, status: "in_place" };
    this.holdsByReference.set(hold.reference, hold);
    order.status = "held";
    order.reference = hold.reference;
    return { outcome: "held", reference: hold.reference };
  }

  /**
   * Runs `work` at most once per request id, the way PayPal treats a PayPal-Request-Id. A lost answer
   * (timeout_after) is still remembered, so sending the request again returns it.
   */
  private once<Result>(method: Method, requestId: string, work: (misbehaviour?: Misbehaviour) => Result): Result | { outcome: "unknown" } {
    if (this.answers.has(requestId)) return this.answers.get(requestId) as Result;
    const misbehaviour = this.misbehaviours.get(method)?.shift();
    if (misbehaviour === "timeout_before") return { outcome: "unknown" };
    const answer = work(misbehaviour);
    this.answers.set(requestId, answer);
    return misbehaviour === "timeout_after" ? { outcome: "unknown" } : answer;
  }
}
