/**
 * Sending one plain-text email (publish to paid spec PT-FR-21). The real one is Resend; tests use a
 * stand-in. An address and a message's text are never logged (PT-BR-11, PT-BR-12).
 */
export interface Message {
  to: string;
  subject: string;
  text: string;
  /** The same key always means the same message: a retry with it is never a second email. */
  idempotencyKey: string;
}

export interface Email {
  /** Hands the message to the service. Throws if the service did not take it. */
  send(message: Message): Promise<void>;
}
