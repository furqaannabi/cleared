/** A stand-in for the email service: it keeps what it was asked to send, and can be taken down. */
import type { Email, Message } from "../src/email/port";

export class FakeEmail implements Email {
  /** Every message that was accepted for sending. */
  readonly sent: Message[] = [];
  /** Makes every send fail, as the service being down or refusing would. */
  down = false;
  /** How many times it was asked, failures included. */
  asked = 0;

  async send(message: Message): Promise<void> {
    this.asked++;
    if (this.down) throw new Error("The email service returned 503");
    // The service sends a message with a key it has seen before only once.
    if (!this.sent.some((earlier) => earlier.idempotencyKey === message.idempotencyKey)) this.sent.push(message);
  }
}
