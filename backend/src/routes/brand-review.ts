/** The brand's review of one post's draft (draft check and review spec DR-FR-32, DR-FR-33, DR-FR-37 to DR-FR-39, DR-FR-47). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { ITEM_KINDS } from "../briefs/reader";
import { PLATFORMS } from "../deals/deals";
import { ErrorSchema, fail, requireBrand, type AppEnv } from "../http/http";
import type { Posts } from "../posts/posts";
import type { Acted, Review } from "../review/review";
import type { Sessions } from "../sessions/sessions";
import { NoteTextSchema } from "./shared";

const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const body = <Schema extends z.ZodType>(schema: Schema) => ({
  body: { required: true, content: { "application/json": { schema } } },
});

const RELEASE_REASONS = ["deadline", "cancelled", "day_28", "fix_window_ended", "not_accepted", "ruled_not_to_pay", "hold_not_confirmed"] as const;

/** One post's review as the brand sees it. No suggestion, earlier status, run number or PayPal email is in it (DR-BR-13). */
const BrandPostSchema = z
  .object({
    dealId: z.string(),
    deliverableId: z.string(),
    creatorName: z.string(),
    brandName: z.string(),
    platform: z.enum(PLATFORMS),
    creatorTimeZone: z.string(),
    hold: z.object({ amount: z.string(), reference: z.string(), deadline: z.string() }),
    review: z.discriminatedUnion("state", [
      z.object({ state: z.literal("nothing_yet") }),
      z.object({ state: z.literal("asked") }),
      z.object({ state: z.literal("window"), endsAt: z.string() }),
      z.object({ state: z.literal("objected"), objectedAt: z.string() }),
      z.object({ state: z.literal("approved"), approvedAt: z.string(), by: z.enum(["brand", "window"]) }),
      z.object({ state: z.literal("released"), releasedAt: z.string(), reason: z.enum(RELEASE_REASONS) }),
    ]),
    draft: z
      .object({
        url: z.string(),
        urlExpiresAt: z.string(),
        durationSec: z.number(),
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            kind: z.enum(ITEM_KINDS),
            checkedBy: z.enum(["exact_match", "ai_timestamp", "from_timestamps", "published_post", "platform_record"]),
            status: z.enum(["passed", "fix_needed", "unsure", "at_live_check", "asked", "accepted", "fix_requested", "objected"]),
            briefLine: z.object({ number: z.number().int(), text: z.string() }).optional(),
            evidence: z.object({ label: z.string(), text: z.string(), startSec: z.number(), endSec: z.number() }).optional(),
            note: z.string().optional(),
          }),
        ),
      })
      .optional(),
  })
  .openapi("BrandPost");

const id = z.string().min(1).max(64);
const post = { params: z.object({ dealId: id, deliverableId: id }) };
const item = { params: z.object({ dealId: id, deliverableId: id, itemId: id }) };

const responses = {
  200: json(BrandPostSchema, "The post's review as it now stands"),
  400: json(ErrorSchema, "The request is not valid"),
  401: json(ErrorSchema, "No session for this deal, whether or not it exists"),
  404: json(ErrorSchema, "No such post or item in this deal"),
  409: json(ErrorSchema, "Not allowed now, with the reason as the code. `window_ended` means an objection came too late (DR-FR-39)"),
};

export function registerBrandReviewRoutes(app: OpenAPIHono<AppEnv>, deps: { sessions: Sessions; posts: Posts; review: Review }) {
  const { posts, review } = deps;
  const session = requireBrand(deps.sessions);

  /** Answers with the post's review, or with why it cannot be shown. */
  const show = async (c: Context<AppEnv>, dealId: string, deliverableId: string) => {
    const found = await posts.brandPost(dealId, deliverableId);
    if (!("refused" in found)) return c.json(found, 200);
    return found.refused === "not_found" ? fail(c, 404, "not_found") : fail(c, 409, "not_held");
  };
  /** Answers with the post's review after a change, or with why the change was refused. */
  const done = async (c: Context<AppEnv>, acted: Acted, dealId: string, deliverableId: string) => {
    if (!acted.ok) return acted.reason === "not_found" ? fail(c, 404, "not_found") : fail(c, 409, acted.reason);
    return show(c, dealId, deliverableId);
  };

  app.openapi(
    createRoute({
      method: "get",
      path: "/brand/deals/{dealId}/deliverables/{deliverableId}",
      summary: "One post's review: where it stands, and the latest draft once the brand is shown it (DR-FR-47, DR-FR-48)",
      middleware: [session] as const,
      request: post,
      responses: { 200: responses[200], 401: responses[401], 404: responses[404], 409: responses[409] },
    }),
    async (c) => {
      const { dealId, deliverableId } = c.req.valid("param");
      // The creator is told their draft was opened (DR-FR-46).
      await review.opened(dealId, deliverableId);
      return show(c, dealId, deliverableId);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/brand/deals/{dealId}/deliverables/{deliverableId}/items/{itemId}/accept",
      summary: "Accept an item the creator asked about; it then counts as passed (DR-FR-32)",
      middleware: [session] as const,
      request: item,
      responses: { 200: responses[200], 401: responses[401], 404: responses[404], 409: responses[409] },
    }),
    async (c) => {
      const { dealId, deliverableId, itemId } = c.req.valid("param");
      return done(c, await review.accept(dealId, deliverableId, itemId), dealId, deliverableId);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/brand/deals/{dealId}/deliverables/{deliverableId}/items/{itemId}/fix",
      summary: "Ask for an item the creator asked about to be fixed instead, with an optional note in plain text (DR-FR-33)",
      middleware: [session] as const,
      request: { ...item, ...body(z.object({ note: z.string().trim().max(500).optional() })) },
      responses,
    }),
    async (c) => {
      const { dealId, deliverableId, itemId } = c.req.valid("param");
      return done(c, await review.askFix(dealId, deliverableId, itemId, c.req.valid("json").note), dealId, deliverableId);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/brand/deals/{dealId}/deliverables/{deliverableId}/approve",
      summary: "Approve the draft, in the review window or after objecting; the draft is then cleared to publish (DR-FR-37, DR-FR-42)",
      middleware: [session] as const,
      request: post,
      responses: { 200: responses[200], 401: responses[401], 404: responses[404], 409: responses[409] },
    }),
    async (c) => {
      const { dealId, deliverableId } = c.req.valid("param");
      return done(c, await review.approve(dealId, deliverableId), dealId, deliverableId);
    },
  );

  const Objections = z
    .array(z.object({ itemId: id, note: NoteTextSchema }))
    .min(1)
    .max(50)
    .refine((list) => new Set(list.map((objection) => objection.itemId)).size === list.length);

  app.openapi(
    createRoute({
      method: "post",
      path: "/brand/deals/{dealId}/deliverables/{deliverableId}/objections",
      summary: "Object to items that passed, each with a note, once per draft; the review window's clock stops (DR-FR-38)",
      middleware: [session] as const,
      request: { ...post, ...body(z.object({ objections: Objections })) },
      responses,
    }),
    async (c) => {
      const { dealId, deliverableId } = c.req.valid("param");
      return done(c, await review.object(dealId, deliverableId, c.req.valid("json").objections), dealId, deliverableId);
    },
  );
}
