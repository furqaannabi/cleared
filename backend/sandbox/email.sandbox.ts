/**
 * The real email adapter against Resend (publish to paid spec, "Against real services, by hand").
 * Run with `pnpm test:email`. It is not part of `pnpm test`: it needs RESEND_API_KEY and EMAIL_FROM,
 * and it sends one real email, to EMAIL_TEST_TO.
 *
 * It sends the brand's "confirm" notice as the service would write it, with a made-up link, twice
 * under one key. Look for exactly one message in the inbox, and read how it looks there.
 */
import { expect, test } from "bun:test";
import { createResend } from "../src/email/resend";
import { noticeEmail } from "../src/publish/notice-email";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;
const to = process.env.EMAIL_TEST_TO;

test("one notice reaches a real inbox, and sending it again under the same key is not a second email", async () => {
  if (!apiKey || !from || !to) throw new Error("Set RESEND_API_KEY, EMAIL_FROM and EMAIL_TEST_TO to run this. See backend/.env.example.");
  const used: Record<string, unknown>[] = [];
  const email = createResend({ apiKey, from, log: (message, details) => used.push({ message, ...details }) });
  const message = noticeEmail({
    kind: "confirm",
    creatorName: "Sam Rivera",
    brandName: "Glow Skincare",
    platform: "youtube_video",
    endsAt: new Date(Date.now() + 48 * 3600 * 1000),
    timeZone: "America/New_York",
    link: "https://app.cleared.example/b/this-is-a-made-up-link",
  });
  const idempotencyKey = `sandbox-${crypto.randomUUID()}`;

  await email.send({ to, ...message, idempotencyKey });
  await email.send({ to, ...message, idempotencyKey });

  console.log(used);
  expect(used.map((call) => call.status)).toEqual([200, 200]);
});
