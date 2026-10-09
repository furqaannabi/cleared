import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getConnInfo } from "hono/bun";
import { cors } from "hono/cors";
import { createAccounts, type Accounts } from "./accounts/accounts";
import { createBrand } from "./brand/brand";
import type { PrismaClient } from "./generated/prisma/client";
import { fail, ownAppOnly, type AppEnv } from "./http/http";
import type { Money } from "./money/money";
import type { GooglePort } from "./google/port";
import { createDeals, type Deals } from "./deals/deals";
import { createInvites } from "./invites/invites";
import type { LinkKeys } from "./invites/link-keys";
import { registerAccountRoutes } from "./routes/account";
import { registerBrandRoutes } from "./routes/brand";
import { registerDealRoutes } from "./routes/deals";
import { registerGoogleRoutes } from "./routes/google";
import { registerInviteRoutes } from "./routes/invite";
import type { Secrets } from "./secrets/secrets";
import { createSessions, defaultSessionSettings } from "./sessions/sessions";

/** No PayPal event comes near this size. Anything larger is turned away before it is read. */
const WEBHOOK_BODY_LIMIT = 256 * 1024;

export interface AppDeps {
  prisma: PrismaClient;
  money?: Money;
  log?: (...parts: unknown[]) => void;
  /** The address of Cleared's own app. The only origin that may make changing requests (DS-BR-03). */
  appOrigin?: string;
  /** The clock. Passed in so the app has none of its own. */
  now?: () => Date;
  /** The address a request came from. Tests set it; the service reads the connection. */
  clientAddress?: (c: Context) => string;
  /** The creators module. The service passes its own, so its jobs and its routes share one. */
  accounts?: Accounts;
  /** The deals module. The service passes its own, so its jobs and its routes share one. */
  deals?: Deals;
  /** The API's own address, which Google sends the browser back to. */
  apiOrigin?: string;
  /** Google, for signing in and connecting YouTube. Left out when it is not set up. */
  google?: GooglePort;
  /** Encrypts Google's refresh token before it is stored (DS-BR-14). */
  secrets?: Secrets;
  /** Works out an invite link's token (DS-FR-32). Without it no link can be made. */
  linkKeys?: LinkKeys;
}

/** The address a request came from, as the connection reports it. */
function connectionAddress(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * The Hono app: the health check, PayPal's webhook, and the creator's and the brand's routes as the
 * deal set-up spec adds them.
 */
export function createApp(deps: AppDeps) {
  const { prisma, money } = deps;
  const log = deps.log ?? console.error;
  const now = deps.now ?? (() => new Date());
  const appOrigin = deps.appOrigin ?? "http://localhost:3000";
  const clientAddress = deps.clientAddress ?? connectionAddress;
  const app = new OpenAPIHono<AppEnv>({
    // A request that fails its schema gets the one error shape, naming the first field at fault (DS-FR-48).
    defaultHook: (result, c) => {
      if (result.success) return;
      const field = result.error.issues[0]?.path.join(".");
      return fail(c, 400, "invalid", field || undefined);
    },
  });

  // Browsers let only the app's own address call the API with a session.
  app.use(
    "*",
    cors({
      origin: (origin) => (origin === appOrigin ? origin : null),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      allowHeaders: ["Content-Type"],
      maxAge: 600,
    }),
  );
  // And the API itself refuses a changing request from anywhere else (DS-BR-03). PayPal's webhook has no
  // origin and proves itself another way; the demo button is a form the page posts.
  app.use("*", ownAppOnly(appOrigin, { noOrigin: ["/webhooks/paypal"], forms: ["/auth/demo"] }));

  const sessions = createSessions({ prisma, now });
  const accounts = deps.accounts ?? createAccounts({ prisma, now });
  registerAccountRoutes(app, {
    sessions,
    accounts,
    appOrigin,
    sessionDays: defaultSessionSettings.creatorDays,
    // Only a hash of the address is kept.
    madeFrom: (c) => new Bun.CryptoHasher("sha256").update(clientAddress(c)).digest("hex"),
  });
  registerDealRoutes(app, { sessions, deals: deps.deals ?? createDeals({ prisma, now }) });
  const invites = createInvites({ prisma, now, appOrigin, linkKeys: deps.linkKeys });
  registerInviteRoutes(app, { sessions, invites });
  registerBrandRoutes(app, { sessions, invites, brand: createBrand({ prisma, now, money }), appOrigin, now });
  registerGoogleRoutes(app, {
    google: deps.google,
    secrets: deps.secrets,
    sessions,
    accounts,
    appOrigin,
    apiOrigin: deps.apiOrigin ?? "http://localhost:4000",
    sessionDays: defaultSessionSettings.creatorDays,
  });

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
