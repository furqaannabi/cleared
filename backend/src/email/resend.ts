/**
 * The real email port: Resend (publish to paid spec PT-FR-21;
 * docs/decisions/2026-10-10-resend-sends-the-brands-two-notices.md). One HTTPS call for one plain-text
 * message. The address is fixed in code. The API key is a server-side secret; neither it, nor an
 * address, nor a message's text is ever logged or put in an error (PT-BR-11, PT-BR-12).
 *
 * Not yet proven against Resend itself. The request is as Resend documents it; `pnpm test:email` sends
 * one real message by hand.
 */
import type { Email } from "./port";

const RESEND = "https://api.resend.com/emails";
const TIMEOUT_MS = 15_000;

export function createResend(config: {
  apiKey: string;
  /** The sender, on a domain verified with Resend: an address, or a name and an address. */
  from: string;
  /** Told how each call went: a status and a timing, never anything from the message. */
  log?: (message: string, details: Record<string, unknown>) => void;
  /** The network. Tests pass a stand-in. */
  fetch?: typeof fetch;
}): Email {
  const call = config.fetch ?? fetch;

  return {
    async send({ to, subject, text, idempotencyKey }) {
      const started = Date.now();
      let status: number | undefined;
      try {
        const response = await call(RESEND, {
          method: "POST",
          headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
          body: JSON.stringify({ from: config.from, to: [to], subject, text }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        status = response.status;
      } catch {
        // Nothing of the error is kept: its message can repeat what was sent.
      }
      config.log?.(status !== undefined && status < 300 ? "Resend took an email" : "Resend did not take an email", { status: status ?? "unreachable", ms: Date.now() - started });
      if (status === undefined) throw new Error("Resend could not be reached");
      // The status only. Resend's answer can repeat the address.
      if (status >= 300) throw new Error(`Resend answered ${status}`);
    },
  };
}
