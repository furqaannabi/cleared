/** The brand's way in and its view of the deal (deal set-up spec DS-FR-34 to DS-FR-37). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Brand } from "../brand/brand";
import { PLATFORMS } from "../deals/deals";
import { ErrorSchema, fail, letBrandIn, requireBrand, type AppEnv } from "../http/http";
import type { Invites } from "../invites/invites";
import type { Sessions } from "../sessions/sessions";

const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

/**
 * A brand's note and the creator's reply, as plain text (DS-FR-38, DS-BR-04). None can be sent yet, so
 * the list is always empty; the shape is here so the pages and the contract already know it.
 */
const NoteSchema = z
  .object({
    id: z.string(),
    about: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("item"), itemId: z.string() }),
      z.object({ kind: z.literal("line"), briefLine: z.number().int() }),
      z.object({ kind: z.enum(["amount", "deadline"]), deliverableId: z.string() }),
      z.object({ kind: z.literal("deal") }),
    ]),
    text: z.string(),
    reply: z.string().optional(),
    version: z.number().int(),
  })
  .openapi("Note");

const BrandDealSchema = z
  .object({
    dealId: z.string(),
    creatorName: z.string(),
    brandName: z.string(),
    step: z.enum(["waiting_for_brand", "changes_requested", "agreed"]),
    version: z.number().int(),
    posts: z.array(
      z.object({
        deliverableId: z.string(),
        platform: z.enum(PLATFORMS),
        amount: z.string(),
        deadlineDays: z.number().int(),
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
}
