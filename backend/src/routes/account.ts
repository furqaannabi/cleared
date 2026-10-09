/** Signing in and the creator's own account (deal set-up spec DS-FR-01 to DS-FR-12). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { Accounts } from "../accounts/accounts";
import { ErrorSchema, fail, ownPath, requireCreator, sessionToken, signIn, signOut, type AppEnv } from "../http/http";
import type { Sessions } from "../sessions/sessions";

const ProfileSchema = z
  .object({
    name: z.string(),
    email: z.string().optional(),
    demo: z.boolean(),
    welcomed: z.boolean(),
    paypalEmail: z.string().optional(),
    accounts: z.array(z.object({ platform: z.enum(["youtube"]), name: z.string() })),
  })
  .openapi("Profile");

const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

export function registerAccountRoutes(
  app: OpenAPIHono<AppEnv>,
  deps: {
    sessions: Sessions;
    accounts: Accounts;
    appOrigin: string;
    sessionDays: number;
    /** The visitor's address, hashed, so demo accounts can be limited without keeping the address (DS-FR-07). */
    madeFrom: (c: Context) => string;
  },
) {
  const { sessions, accounts, appOrigin } = deps;
  const creator = requireCreator(sessions);

  // "Try the demo account" is a form posted by the page, so the answer is a redirect into the app (DS-FR-06).
  app.post("/auth/demo", async (c) => {
    const demo = await accounts.startDemo(deps.madeFrom(c));
    // The page was navigated here, so a refusal is shown by the app, not as an error body (DS-FR-07).
    if (demo === "too_many") return c.redirect(`${appOrigin}/sign-in?problem=demo_limit`, 303);
    signIn(c, await sessions.start(demo.creatorId), appOrigin, deps.sessionDays);
    return c.redirect(`${appOrigin}${ownPath(c.req.query("next"), appOrigin) ?? "/deals"}`, 303);
  });

  app.openapi(
    createRoute({
      method: "post",
      path: "/auth/sign-out",
      summary: "Sign out (DS-FR-05)",
      responses: { 200: json(z.object({}), "Signed out, or nobody was signed in") },
    }),
    async (c) => {
      const token = sessionToken(c);
      if (token) await sessions.end(token);
      signOut(c, appOrigin);
      return c.json({}, 200);
    },
  );

  const profileResponses = {
    200: json(ProfileSchema, "The creator's profile"),
    401: json(ErrorSchema, "Nobody is signed in"),
  };
  /** The creator's profile as it now stands, which every route here answers with. */
  const profileOf = async (c: Context<AppEnv>) => {
    const profile = await accounts.profile(c.get("creatorId"));
    return profile ? c.json(profile, 200) : fail(c, 401, "signed_out");
  };

  app.openapi(
    createRoute({
      method: "get",
      path: "/me",
      summary: "The signed-in creator (DS-FR-08)",
      middleware: [creator] as const,
      responses: profileResponses,
    }),
    profileOf,
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/me/welcomed",
      summary: "Record that the creator has seen the welcome page (DS-FR-09)",
      middleware: [creator] as const,
      responses: profileResponses,
    }),
    async (c) => {
      await accounts.markWelcomed(c.get("creatorId"));
      return profileOf(c);
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/me/paypal-email",
      summary: "Save the PayPal email the creator is paid at (DS-FR-10)",
      middleware: [creator] as const,
      request: { body: { required: true, content: { "application/json": { schema: z.object({ email: z.email().max(254) }) } } } },
      responses: { ...profileResponses, 400: json(ErrorSchema, "The email is not valid") },
    }),
    async (c) => {
      await accounts.setPaypalEmail(c.get("creatorId"), c.req.valid("json").email);
      return profileOf(c);
    },
  );
}
