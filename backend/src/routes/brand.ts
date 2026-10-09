/** The brand's way in, its view of the deal, asking for changes and agreeing (deal set-up spec DS-FR-34 to DS-FR-42). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Brand } from "../brand/brand";
import { PLATFORMS } from "../deals/deals";
import { ErrorSchema, fail, letBrandIn, requireBrand, type AppEnv } from "../http/http";
import type { Invites } from "../invites/invites";
import type { Sessions } from "../sessions/sessions";
import { NoteAboutSchema, NoteSchema, NoteTextSchema } from "./shared";

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
    posts: z.array(
      z.object({
        deliverableId: z.string(),
        platform: z.enum(PLATFORMS),
        amount: z.string(),
        deadlineDays: z.number().int(),
        changed: z.array(z.enum(["amount", "deadline"])).optional(),
        hold: z.object({ state: z.enum(["not_started"]) }),
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
  deps: { sessions: Sessions; invites: Invites; brand: Brand; appOrigin: string; now: () => Date },
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
        200: json(z.object({ dealId: z.string() }).openapi("BrandSession"), "The deal the link opens. The session is an HttpOnly cookie"),
        404: json(ErrorSchema, "The link does not work: expired, turned off or unknown, with no reason given (DS-FR-35)"),
      },
    }),
    async (c) => {
      const link = await invites.openLink(c.req.valid("param").token);
      if (!link) return fail(c, 404, "link_not_working");
      const token = await sessions.startForBrand(link);
      const seconds = Math.max(0, Math.floor((link.expiresAt.getTime() - now().getTime()) / 1000));
      letBrandIn(c, link.dealId, token, appOrigin, seconds);
      return c.json({ dealId: link.dealId }, 200);
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
}
