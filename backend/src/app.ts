import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { PrismaClient } from "./generated/prisma/client";
import type { Money } from "./money/money";

/** No PayPal event comes near this size. Anything larger is turned away before it is read. */
const WEBHOOK_BODY_LIMIT = 256 * 1024;

/**
 * The Hono app. Besides the health check it has one route so far: PayPal's webhook. The brand's and the
 * creator's routes are added with the spec that needs them.
 */
export function createApp(deps: { prisma: PrismaClient; money?: Money; log?: (...parts: unknown[]) => void }) {
  const { prisma, money } = deps;
  const log = deps.log ?? console.error;
  const app = new Hono();

  /** Reports whether the service is up and can reach Postgres. Used by the load balancer. */
  app.get("/health", async (c) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return c.json({ status: "ok" });
    } catch {
      return c.json({ status: "unavailable" }, 503);
    }
  });

  if (money) {
    /**
     * PayPal's events (money path spec MP-FR-35). The one public route: anyone can post to it, so nothing
     * is believed until PayPal confirms it sent the event. The body is passed on exactly as received,
     * because PayPal signed those bytes.
     */
    app.post(
      "/webhooks/paypal",
      bodyLimit({ maxSize: WEBHOOK_BODY_LIMIT, onError: (c) => c.text("Too large", 413) }),
      async (c) => {
        try {
          const body = await c.req.text();
          const result = await money.webhook({ headers: Object.fromEntries(c.req.raw.headers), body });
          if (result === "rejected") {
            // PayPal's own id for the delivery only. The body is never logged (MP-BR-11).
            log("A PayPal webhook failed verification and was rejected", {
              transmissionId: c.req.header("paypal-transmission-id")?.slice(0, 100),
            });
            return c.text("Not verified", 400);
          }
          // Handled, ignored or already seen: all acknowledged, so PayPal stops sending it.
          return c.text("OK");
        } catch (error) {
          log("Acting on a PayPal webhook failed; PayPal will send it again", {
            error: error instanceof Error ? error.name : "unknown",
          });
          return c.text("Try again", 500);
        }
      },
    );
  }

  return app;
}
