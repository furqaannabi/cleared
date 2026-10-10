/** The creator's deals (deal set-up spec DS-FR-13 to DS-FR-16). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { ITEM_KINDS } from "../briefs/reader";
import { PLATFORMS, type Answer, type Deals, type DescribePosts, type EditRefused, type Platform } from "../deals/deals";
import { ErrorSchema, fail, requireCreator, type AppEnv } from "../http/http";
import type { Sessions } from "../sessions/sessions";
import { NoteSchema } from "./shared";

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
    brief: z.object({ lines: z.array(z.object({ number: z.number().int(), text: z.string() })) }).optional(),
    reading: z.enum(["idle", "reading", "done", "failed"]),
    items: z.array(
      z.object({
        id: z.string(),
        deliverableId: z.string(),
        name: z.string(),
        kind: z.enum(ITEM_KINDS),
        briefLine: z.number().int().optional(),
        addedByCreator: z.boolean(),
        checkedBy: z.enum(["exact_match", "ai_timestamp", "at_live_check"]),
      }),
    ),
    questions: z.array(
      z.object({
        id: z.string(),
        briefLine: z.number().int(),
        text: z.string(),
        suggestions: z.array(z.string()),
        answer: z.object({ kind: z.enum(["suggestion", "own_words", "left_out"]), text: z.string().optional() }).optional(),
      }),
    ),
    ready: z.boolean(),
    notes: z.array(NoteSchema).optional(),
  })
  .openapi("DealDraft");

const DealSummarySchema = z
  .object({
    id: z.string(),
    brandName: z.string(),
    status: z.string(),
    step: StepSchema.optional(),
    openDeliverableId: z.string().optional(),
    deliverables: z.array(
      z.object({
        id: z.string(),
        platform: PlatformSchema,
        state: z.enum(["no_draft", "checking", "check_failed", "results", "fully_passing", "objected", "approved", "posting", "published", "captured", "paid", "approved_not_paid", "released"]),
      }),
    ),
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

export function registerDealRoutes(app: OpenAPIHono<AppEnv>, deps: { sessions: Sessions; deals: Deals; describePosts?: DescribePosts }) {
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
    async (c) => c.json(await deals.list(c.get("creatorId"), deps.describePosts), 200),
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

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals/{dealId}/brief",
      summary: "Send the brief; reading starts as a job (DS-FR-17)",
      middleware: [creator] as const,
      // The length is checked by the deals module, which owns the limits and trims the text first.
      request: { ...dealId, ...body(z.object({ text: z.string().max(200_000) })) },
      responses: {
        200: json(DealDraftSchema, "The deal, with its brief as numbered lines, being read"),
        ...refusals,
        409: json(ErrorSchema, "The brief is being read or has been read"),
        429: json(ErrorSchema, "A limit on reading briefs was reached"),
      },
    }),
    async (c) => {
      const sent = await deals.sendBrief(c.get("creatorId"), c.req.valid("param").dealId, c.req.valid("json").text);
      if (!("refused" in sent)) return c.json(sent, 200);
      switch (sent.refused) {
        case "not_found":
          return fail(c, 404, "not_found");
        case "reading_started":
          return fail(c, 409, "reading_started");
        case "too_short":
        case "too_long":
          return fail(c, 400, sent.refused, "text");
        case "read_limit":
          // Which limit, and when a daily one lifts (DS-FR-28).
          return c.json({ error: { code: "read_limit", field: sent.limit, resetsAt: sent.resetsAt?.toISOString() } }, 429);
      }
    },
  );

  /** Answers every checklist route gives when the change was refused. */
  const refused = (c: Context<AppEnv>, why: EditRefused) => {
    switch (why.refused) {
      case "not_found":
        return fail(c, 404, "not_found");
      case "not_editable":
        return fail(c, 409, "not_editable");
      case "unknown_suggestion":
        return fail(c, 400, "unknown_suggestion", "text");
      case "unknown_post":
        return fail(c, 400, "unknown_post", "deliverableId");
      case "questions_unanswered":
      case "post_without_items":
      case "not_ready":
        return fail(c, 409, why.refused);
    }
  };
  const checklistResponses = {
    200: json(DealDraftSchema, "The deal as it now stands"),
    ...refusals,
    409: json(ErrorSchema, "The checklist cannot be changed now"),
  };
  const questionId = { params: z.object({ dealId: z.string().min(1).max(64), questionId: z.string().min(1).max(64) }) };

  app.openapi(
    createRoute({
      method: "put",
      path: "/deals/{dealId}/questions/{questionId}",
      summary: "Answer a question about an unclear line of the brief (DS-FR-23)",
      middleware: [creator] as const,
      request: {
        ...questionId,
        ...body(z.object({ kind: z.enum(["suggestion", "own_words", "left_out"]), text: z.string().trim().max(200).optional() })),
      },
      responses: checklistResponses,
    }),
    async (c) => {
      const { dealId: deal, questionId: question } = c.req.valid("param");
      const sent = c.req.valid("json");
      // A suggestion and the creator's own words both need their text.
      if (sent.kind !== "left_out" && !sent.text) return fail(c, 400, "invalid", "text");
      const answer: Answer = sent.kind === "left_out" ? { kind: "left_out" } : { kind: sent.kind, text: sent.text ?? "" };
      const changed = await deals.answerQuestion(c.get("creatorId"), deal, question, answer);
      return "refused" in changed ? refused(c, changed) : c.json(changed, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/deals/{dealId}/questions/{questionId}",
      summary: "Reopen an answered question (DS-FR-23)",
      middleware: [creator] as const,
      request: questionId,
      responses: checklistResponses,
    }),
    async (c) => {
      const { dealId: deal, questionId: question } = c.req.valid("param");
      const changed = await deals.reopenQuestion(c.get("creatorId"), deal, question);
      return "refused" in changed ? refused(c, changed) : c.json(changed, 200);
    },
  );

  const itemId = { params: z.object({ dealId: z.string().min(1).max(64), itemId: z.string().min(1).max(64) }) };
  /** An item's wording: plain text, trimmed, 1 to 200 characters. */
  const itemName = z.string().trim().min(1).max(200);
  const toPost = body(z.object({ deliverableId: z.string().min(1).max(64) }));
  /** Answers with the deal as changed, or with why the change was refused. */
  const done = (c: Context<AppEnv>, changed: Awaited<ReturnType<Deals["markReady"]>>) =>
    "refused" in changed ? refused(c, changed) : c.json(changed, 200);

  app.openapi(
    createRoute({
      method: "patch",
      path: "/deals/{dealId}/items/{itemId}",
      summary: "Reword an item; its citation stays (DS-FR-24)",
      middleware: [creator] as const,
      request: { ...itemId, ...body(z.object({ name: itemName })) },
      responses: checklistResponses,
    }),
    async (c) => {
      const { dealId: deal, itemId: item } = c.req.valid("param");
      return done(c, await deals.renameItem(c.get("creatorId"), deal, item, c.req.valid("json").name));
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/deals/{dealId}/items/{itemId}",
      summary: "Remove an item (DS-FR-24)",
      middleware: [creator] as const,
      request: itemId,
      responses: checklistResponses,
    }),
    async (c) => {
      const { dealId: deal, itemId: item } = c.req.valid("param");
      return done(c, await deals.removeItem(c.get("creatorId"), deal, item));
    },
  );

  for (const how of ["copy", "move"] as const) {
    app.openapi(
      createRoute({
        method: "post",
        path: `/deals/{dealId}/items/{itemId}/${how}`,
        summary: `${how === "copy" ? "Copy" : "Move"} an item to another of the deal's posts (DS-FR-24)`,
        middleware: [creator] as const,
        request: { ...itemId, ...toPost },
        responses: checklistResponses,
      }),
      async (c) => {
        const { dealId: deal, itemId: item } = c.req.valid("param");
        return done(c, await deals.placeItem(c.get("creatorId"), deal, item, c.req.valid("json").deliverableId, how));
      },
    );
  }

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals/{dealId}/items",
      summary: "Add an item of the creator's own, not from the brief (DS-FR-24)",
      middleware: [creator] as const,
      request: {
        ...dealId,
        ...body(z.object({ deliverableId: z.string().min(1).max(64), name: itemName, kind: z.enum(ITEM_KINDS) })),
      },
      responses: checklistResponses,
    }),
    async (c) => done(c, await deals.addItem(c.get("creatorId"), c.req.valid("param").dealId, c.req.valid("json"))),
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals/{dealId}/checklist/ready",
      summary: "Mark the checklist ready; the deal moves to the invite step (DS-FR-25)",
      middleware: [creator] as const,
      request: dealId,
      responses: checklistResponses,
    }),
    async (c) => done(c, await deals.markReady(c.get("creatorId"), c.req.valid("param").dealId)),
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals/{dealId}/checklist/reopen",
      summary: "Go back to the checklist step, to edit it again (DS-FR-25)",
      middleware: [creator] as const,
      request: dealId,
      responses: checklistResponses,
    }),
    async (c) => done(c, await deals.reopenChecklist(c.get("creatorId"), c.req.valid("param").dealId)),
  );
}
