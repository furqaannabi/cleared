import { Hono } from "hono";
import { prisma } from "./db";

/**
 * The Hono app. It has no product routes yet: each one is added with the
 * spec that needs it.
 */
export const app = new Hono();

/** Reports whether the service is up and can reach Postgres. Used by the load balancer. */
app.get("/health", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ status: "ok" });
  } catch {
    return c.json({ status: "unavailable" }, 503);
  }
});
