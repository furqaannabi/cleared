/**
 * The real email adapter, with the network replaced by a stand-in (publish to paid spec PT-FR-21,
 * PT-BR-11, PT-BR-12). Resend itself is checked by hand: `pnpm test:email`.
 */
import { describe, expect, test } from "bun:test";
import { createResend } from "./resend";

const message = { to: "maya@glow.example", subject: "Confirm Sam Rivera's live post on Cleared", text: "Review the post:\nhttps://app.cleared.test/b/secret-token", idempotencyKey: "brand-notice-1" };

/** A network that answers as the test says, and remembers what it was sent. */
function standIn(answer: { status: number; body?: string } | "fails") {
  const calls: { url: string; init: RequestInit }[] = [];
  const logged: unknown[] = [];
  const email = createResend({
    apiKey: "re_test_key",
    from: "Cleared <notices@cleared.example>",
    log: (...parts) => logged.push(parts),
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      if (answer === "fails") throw new Error(`could not reach Resend for ${message.to}`);
      return new Response(answer.body ?? '{"id":"email_1"}', { status: answer.status });
    }) as typeof fetch,
  });
  return { email, calls, logged };
}

describe("PT-FR-21 one plain-text message to one address, through Resend", () => {
  test("it is sent to Resend's own address with the key, the sender, the one recipient and the text, and no HTML", async () => {
    const { email, calls } = standIn({ status: 200 });

    await email.send(message);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(calls[0]!.init.method).toBe("POST");
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get("authorization")).toBe("Bearer re_test_key");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ from: "Cleared <notices@cleared.example>", to: ["maya@glow.example"], subject: message.subject, text: message.text });
  });

  test("the message's own key goes with it, so a retry is never a second email", async () => {
    const { email, calls } = standIn({ status: 200 });

    await email.send(message);

    expect(new Headers(calls[0]!.init.headers).get("idempotency-key")).toBe("brand-notice-1");
  });

  test.each([400, 401, 403, 422, 429, 500, 503])("an answer of %i is a failure, so the job tries again", async (status) => {
    const { email } = standIn({ status, body: JSON.stringify({ message: `cannot send to ${message.to}` }) });

    expect(email.send(message)).rejects.toThrow(`Resend answered ${status}`);
  });

  test("a network that cannot be reached is a failure too", async () => {
    const { email } = standIn("fails");

    expect(email.send(message)).rejects.toThrow("Resend could not be reached");
  });
});

describe("PT-BR-11, PT-BR-12 nothing of the address, the link or the key is logged or thrown", () => {
  test.each([
    ["a message that was sent", { status: 200 } as const],
    ["one Resend refused, whose answer repeats the address", { status: 422, body: '{"message":"maya@glow.example is not allowed"}' } as const],
    ["one that could not be reached", "fails" as const],
  ])("%s", async (_what, answer) => {
    const { email, logged } = standIn(answer);

    const thrown = await email.send(message).then(
      () => "",
      (error: Error) => error.message,
    );

    for (const secret of ["maya@glow.example", "secret-token", "re_test_key"]) {
      expect(JSON.stringify(logged)).not.toContain(secret);
      expect(thrown).not.toContain(secret);
    }
    expect(logged).toHaveLength(1);
  });
});
