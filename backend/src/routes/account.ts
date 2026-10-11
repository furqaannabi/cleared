/** Signing in and the creator's own account (deal set-up spec DS-FR-01 to DS-FR-12). */
import type { Payouts } from "../payouts/payouts";
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { Accounts } from "../accounts/accounts";
import { ErrorSchema, fail, requireCreator, sessionToken, signOut, type AppEnv } from "../http/http";
import type { Sessions } from "../sessions/sessions";

const ProfileSchema = z
  .object({
    name: z.string(),
    email: z.string().optional(),
    welcomed: z.boolean(),
    paypalEmail: z.string().optional(),
    accounts: z.array(z.object({ platform: z.enum(["youtube", "instagram"]), name: z.string() })),
  })
  .openapi("Profile");

const PostKeepingEmailSchema = z.object({ deliverableId: z.string(), dealId: z.string(), brandName: z.string(), email: z.string() }).openapi("PostKeepingEmail");

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
    /** Carries a new PayPal email to the creator's posts that are not yet paid out (PT-FR-27). */
    payouts?: Pick<Payouts, "emailChanged">;
  },
) {
  const { sessions, accounts, appOrigin, payouts } = deps;
  const creator = requireCreator(sessions);

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
      summary: "Save the PayPal email the creator is paid at. It reaches every post of theirs whose payout is not with PayPal (DS-FR-10, PT-FR-27)",
      middleware: [creator] as const,
      request: { body: { required: true, content: { "application/json": { schema: z.object({ email: z.email().max(254) }) } } } },
      responses: {
        200: json(ProfileSchema.extend({ postsKeepingEmail: z.array(PostKeepingEmailSchema) }).openapi("ProfileAfterEmail"), "The creator's profile, and the posts whose payout is already with PayPal and keeps the email it went to"),
        401: json(ErrorSchema, "Nobody is signed in"),
        400: json(ErrorSchema, "The email is not valid"),
      },
    }),
    async (c) => {
      const { email } = c.req.valid("json");
      await accounts.setPaypalEmail(c.get("creatorId"), email);
      const postsKeepingEmail = (await payouts?.emailChanged(c.get("creatorId"), email)) ?? [];
      const profile = await accounts.profile(c.get("creatorId"));
      return profile ? c.json({ ...profile, postsKeepingEmail }, 200) : fail(c, 401, "signed_out");
    },
  );
}
