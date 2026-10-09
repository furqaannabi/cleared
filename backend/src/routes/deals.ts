/** The creator's deals (deal set-up spec DS-FR-13 to DS-FR-16). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { PLATFORMS, type Deals, type Platform } from "../deals/deals";
import { ErrorSchema, fail, requireCreator, type AppEnv } from "../http/http";
import type { Sessions } from "../sessions/sessions";

const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

/** Every kind of post the pages know. A Reel is understood and refused, with a reason, until Instagram is built. */
const AnyPlatform = z.enum([...PLATFORMS, "instagram_reel"]);
const PlatformSchema = z.enum(PLATFORMS);
const StepSchema = z.enum(["checklist", "invite", "waiting_for_brand", "changes_requested", "agreed"]);

const DealDraftSchema = z
  .object({
    id: z.string(),
    brandName: z.string(),
    step: StepSchema,
    deliverables: z.array(z.object({ id: z.string(), platform: PlatformSchema })),
    reading: z.enum(["idle", "reading", "done", "failed"]),
    items: z.array(z.never()),
    questions: z.array(z.never()),
    ready: z.boolean(),
  })
  .openapi("DealDraft");

const DealSummarySchema = z
  .object({
    id: z.string(),
    brandName: z.string(),
    status: z.string(),
    step: StepSchema,
    deliverables: z.array(z.object({ id: z.string(), platform: PlatformSchema, state: z.enum(["no_draft"]) })),
  })
  .openapi("DealSummary");

/** The brand's name is plain text, trimmed, 1 to 120 characters. A deal has 1 to 10 posts. */
const brandName = z.string().trim().min(1).max(120);
const posts = <Post extends z.ZodType>(post: Post) => z.array(post).min(1).max(10);

const StartDealSchema = z.object({ brandName, deliverables: posts(z.object({ platform: AnyPlatform })) });
const ChangeDealSchema = z.object({
  brandName,
  deliverables: posts(z.object({ id: z.string().min(1).max(64).optional(), platform: AnyPlatform })),
});

const body = <Schema extends z.ZodType>(schema: Schema) => ({
  body: { required: true, content: { "application/json": { schema } } },
});
const dealId = { params: z.object({ dealId: z.string().min(1).max(64) }) };

const refusals = {
  400: json(ErrorSchema, "The request is not valid"),
  401: json(ErrorSchema, "Nobody is signed in"),
  404: json(ErrorSchema, "No such deal, or it is not this creator's"),
};

export function registerDealRoutes(app: OpenAPIHono<AppEnv>, deps: { sessions: Sessions; deals: Deals }) {
  const { deals } = deps;
  const creator = requireCreator(deps.sessions);

  /** The place of the first post that cannot be in a deal yet, if there is one (DS-FR-13). */
  const notAvailable = (sent: { platform: string }[]) => sent.findIndex((post) => post.platform === "instagram_reel");

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals",
      summary: "Start a deal (DS-FR-13)",
      middleware: [creator] as const,
      request: body(StartDealSchema),
      responses: { 200: json(DealDraftSchema, "The new deal"), 400: refusals[400], 401: refusals[401] },
    }),
    async (c) => {
      const input = c.req.valid("json");
      const reel = notAvailable(input.deliverables);
      if (reel !== -1) return fail(c, 400, "platform_not_available", `deliverables.${reel}.platform`);
      const platforms = input.deliverables.map((post) => post.platform as Platform);
      return c.json(await deals.start(c.get("creatorId"), { brandName: input.brandName, platforms }), 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/deals",
      summary: "The creator's deals (DS-FR-14)",
      middleware: [creator] as const,
      responses: { 200: json(z.array(DealSummarySchema), "The creator's own deals, newest first"), 401: refusals[401] },
    }),
    async (c) => c.json(await deals.list(c.get("creatorId")), 200),
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/deals/{dealId}",
      summary: "One deal (DS-FR-15)",
      middleware: [creator] as const,
      request: dealId,
      responses: { 200: json(DealDraftSchema, "The deal"), 401: refusals[401], 404: refusals[404] },
    }),
    async (c) => {
      const deal = await deals.draft(c.get("creatorId"), c.req.valid("param").dealId);
      return deal ? c.json(deal, 200) : fail(c, 404, "not_found");
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/deals/{dealId}",
      summary: "Change the brand or the posts, before the brief is sent (DS-FR-16)",
      middleware: [creator] as const,
      request: { ...dealId, ...body(ChangeDealSchema) },
      responses: { 200: json(DealDraftSchema, "The deal as changed"), ...refusals, 409: json(ErrorSchema, "The brief has been sent") },
    }),
    async (c) => {
      const input = c.req.valid("json");
      const reel = notAvailable(input.deliverables);
      if (reel !== -1) return fail(c, 400, "platform_not_available", `deliverables.${reel}.platform`);
      const changed = await deals.change(c.get("creatorId"), c.req.valid("param").dealId, {
        brandName: input.brandName,
        posts: input.deliverables.map((post) => ({ id: post.id, platform: post.platform as Platform })),
      });
      if (!("refused" in changed)) return c.json(changed, 200);
      switch (changed.refused) {
        case "not_found":
          return fail(c, 404, "not_found");
        case "reading_started":
          return fail(c, 409, "reading_started");
        case "unknown_post":
          return fail(c, 400, "unknown_post", `deliverables.${changed.index}.id`);
      }
    },
  );
}
