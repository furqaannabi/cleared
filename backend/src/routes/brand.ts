/** The brand's way in, its view of the deal, asking for changes, agreeing and the holds (deal set-up spec DS-FR-34 to DS-FR-45). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { Brand, HoldRefused } from "../brand/brand";
import { PLATFORMS } from "../deals/deals";
import { ErrorSchema, fail, letBrandIn, requireBrand, type AppEnv } from "../http/http";
import type { Invites } from "../invites/invites";
import type { Sessions } from "../sessions/sessions";
import { HoldSchema, NoteAboutSchema, NoteSchema, NoteTextSchema } from "./shared";

const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

const BrandDealSchema = z
  .object({
    dealId: z.string(),
    creatorName: z.string(),
    brandName: z.string(),
    step: z.enum(["waiting_for_brand", "changes_requested", "agreed"]),
    version: z.number().int(),
    agreedAt: z.string().optional(),
    paypalClientId: z.string().optional(),
    posts: z.array(
      z.object({
        deliverableId: z.string(),
        platform: z.enum(PLATFORMS),
        amount: z.string(),
        deadlineDays: z.number().int(),
        changed: z.array(z.enum(["amount", "deadline"])).optional(),
        hold: HoldSchema,
        review: z
          .discriminatedUnion("state", [
            z.object({ state: z.enum(["nothing_yet", "approved", "released"]) }),
            z.object({ state: z.enum(["asked", "objected"]), count: z.number().int() }),
            z.object({ state: z.literal("window"), endsAt: z.string() }),
          ])
          .optional(),
      }),
    ),
    items: z.array(
      z.object({
        id: z.string(),
        deliverableId: z.string(),
        name: z.string(),
        briefLine: z.number().int().optional(),
        addedByCreator: z.boolean(),
        changed: z.boolean().optional(),
      }),
    ),
    brief: z.array(z.object({ number: z.number().int(), text: z.string() })),
    answers: z.array(
      z.object({ briefLine: z.number().int(), kind: z.enum(["suggestion", "own_words", "left_out"]), text: z.string().optional() }),
    ),
    notes: z.array(NoteSchema),
  })
  .openapi("BrandDeal");

export function registerBrandRoutes(
  app: OpenAPIHono<AppEnv>,
  deps: {
    sessions: Sessions;
    invites: Invites;
    brand: Brand;
    appOrigin: string;
    now: () => Date;
    /** Whether the brand still has something to do on a post's draft. Without it no review link opens anything. */
    reviewNeeded?: (deliverableId: string) => Promise<boolean>;
  },
) {
  const { sessions, invites, brand, appOrigin, now } = deps;
  const session = requireBrand(sessions);

  app.openapi(
    createRoute({
      method: "post",
      path: "/b/{token}/session",
      summary: "Swap an invite link's token for a session scoped to its deal (DS-FR-34)",
      // Any text is taken as a token, so one that is malformed is answered exactly as one that is unknown.
      request: { params: z.object({ token: z.string().max(512) }) },
      responses: {
        200: json(
          z.object({ dealId: z.string(), deliverableId: z.string().optional() }).openapi("BrandSession"),
          "The deal the link opens, and for a review link the post to land on. The session is an HttpOnly cookie",
        ),
        404: json(ErrorSchema, "The link does not work: expired, turned off or unknown, with no reason given (DS-FR-35)"),
      },
    }),
    async (c) => {
      const link = await invites.openLink(c.req.valid("param").token);
      // A review link works only while the brand has something to do on that post's draft (DR-FR-45).
      if (!link || (link.deliverableId && !(await deps.reviewNeeded?.(link.deliverableId)))) return fail(c, 404, "link_not_working");
      const token = await sessions.startForBrand(link);
      const seconds = Math.max(0, Math.floor((link.expiresAt.getTime() - now().getTime()) / 1000));
      letBrandIn(c, link.dealId, token, appOrigin, seconds);
      return c.json({ dealId: link.dealId, ...(link.deliverableId ? { deliverableId: link.deliverableId } : {}) }, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/brand/deals/{dealId}",
      summary: "The deal as its brand sees it: the terms, the checklist and where each item came from (DS-FR-36)",
      middleware: [session] as const,
      request: { params: z.object({ dealId: z.string().min(1).max(64) }) },
      responses: {
        200: json(BrandDealSchema, "The deal, at the latest version sent to the brand"),
        401: json(ErrorSchema, "No session for this deal, whether or not it exists (DS-FR-37)"),
      },
    }),
    async (c) => {
      const deal = await brand.deal(c.req.valid("param").dealId);
      // A session for a deal that has gone is no session at all.
      return deal ? c.json(deal, 200) : fail(c, 401, "signed_out");
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/brand/deals/{dealId}/notes",
      summary: "Ask for changes: a set of notes sent together, in plain text (DS-FR-38)",
      middleware: [session] as const,
      request: {
        params: z.object({ dealId: z.string().min(1).max(64) }),
        body: {
          required: true,
          content: { "application/json": { schema: z.object({ notes: z.array(z.object({ about: NoteAboutSchema, text: NoteTextSchema })).min(1).max(50) }) } },
        },
      },
      responses: {
        200: json(BrandDealSchema, "The deal, now with changes asked"),
        400: json(ErrorSchema, "A note is not valid, or is about something that is not in this deal"),
        401: json(ErrorSchema, "No session for this deal, whether or not it exists (DS-FR-37)"),
        409: json(ErrorSchema, "Notes cannot be sent now: the creator has not answered the last ones, or the deal is agreed"),
      },
    }),
    async (c) => {
      const sent = await brand.sendNotes(c.req.valid("param").dealId, c.req.valid("json").notes);
      if (!sent) return fail(c, 401, "signed_out");
      if (!("refused" in sent)) return c.json(sent, 200);
      switch (sent.refused) {
        case "not_waiting_for_brand":
          return fail(c, 409, "not_waiting_for_brand");
        case "unknown_subject":
          return fail(c, 400, "unknown_subject", `notes.${sent.index}.about`);
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/brand/deals/{dealId}/agree",
      summary: "Agree to the version shown; each post's money is opened, ready for its hold (DS-FR-41, DS-FR-42)",
      middleware: [session] as const,
      request: {
        params: z.object({ dealId: z.string().min(1).max(64) }),
        body: { required: true, content: { "application/json": { schema: z.object({ version: z.number().int().positive() }) } } },
      },
      responses: {
        200: json(BrandDealSchema, "The deal, agreed"),
        400: json(ErrorSchema, "The request is not valid"),
        401: json(ErrorSchema, "No session for this deal, whether or not it exists (DS-FR-37)"),
        409: json(ErrorSchema, "Not agreed: the version is out of date, changes are being answered, or it is already agreed"),
        503: json(ErrorSchema, "This service is not set up to hold money, so nothing can be agreed"),
      },
    }),
    async (c) => {
      const agreed = await brand.agree(c.req.valid("param").dealId, c.req.valid("json").version);
      if (!agreed) return fail(c, 401, "signed_out");
      if (!("refused" in agreed)) return c.json(agreed, 200);
      return agreed.refused === "not_set_up" ? fail(c, 503, "not_set_up") : fail(c, 409, agreed.refused);
    },
  );

  const post = { params: z.object({ dealId: z.string().min(1).max(64), deliverableId: z.string().min(1).max(64) }) };
  const order = { body: { required: true, content: { "application/json": { schema: z.object({ orderId: z.string().min(1).max(64) }) } } } };
  const holdRefusals = {
    400: json(ErrorSchema, "The request is not valid"),
    401: json(ErrorSchema, "No session for this deal, whether or not it exists (DS-FR-37)"),
    404: json(ErrorSchema, "The post is not one of this deal's"),
    409: json(ErrorSchema, "The money path refused, with its reason as the code (MP-FR-02, MP-FR-03)"),
    503: json(ErrorSchema, "PayPal gave no clear answer, or this service is not set up to hold money. Try again"),
  };
  /** Answers a hold route gives when it was refused. The money path's own reason is passed on as the code. */
  const holdRefused = (c: Context<AppEnv>, why: HoldRefused) => {
    switch (why.refused) {
      case "unknown_post":
        return fail(c, 404, "not_found");
      case "not_set_up":
        return fail(c, 503, "not_set_up");
      case "money":
        return why.reason === "paypal_unclear" ? fail(c, 503, "paypal_unclear") : fail(c, 409, why.reason);
    }
  };

  app.openapi(
    createRoute({
      method: "post",
      path: "/brand/deals/{dealId}/posts/{deliverableId}/hold",
      summary: "Start one post's hold: a PayPal order for its amount, for the page's PayPal button (DS-FR-43)",
      middleware: [session] as const,
      request: post,
      responses: {
        200: json(z.object({ orderId: z.string() }).openapi("HoldStart"), "The PayPal order to approve"),
        401: holdRefusals[401],
        404: holdRefusals[404],
        409: holdRefusals[409],
        503: holdRefusals[503],
      },
    }),
    async (c) => {
      const { dealId, deliverableId } = c.req.valid("param");
      const started = await brand.startHold(dealId, deliverableId);
      if (!started) return fail(c, 401, "signed_out");
      return "refused" in started ? holdRefused(c, started) : c.json(started, 200);
    },
  );

  for (const what of ["approved", "closed"] as const) {
    app.openapi(
      createRoute({
        method: "post",
        path: `/brand/deals/{dealId}/posts/{deliverableId}/hold/${what}`,
        summary:
          what === "approved"
            ? "PayPal approved the order: it is authorized, and the post's hold is reported as it now stands (DS-FR-44)"
            : "The brand closed PayPal without approving: nothing is held (DS-FR-44)",
        middleware: [session] as const,
        request: { ...post, ...order },
        responses: { 200: json(BrandDealSchema, "The deal, with the post's hold as it now stands"), ...holdRefusals },
      }),
      async (c) => {
        const { dealId, deliverableId } = c.req.valid("param");
        const reported = await brand.holdReported(dealId, deliverableId, c.req.valid("json").orderId, what);
        if (!reported) return fail(c, 401, "signed_out");
        return "refused" in reported ? holdRefused(c, reported) : c.json(reported, 200);
      },
    );
  }
}
