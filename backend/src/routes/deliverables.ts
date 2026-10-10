/** The creator's post at the draft check (draft check and review spec DR-FR-01 to DR-FR-09). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import { ITEM_KINDS } from "../briefs/reader";
import { PLATFORMS } from "../deals/deals";
import type { Drafts } from "../drafts/drafts";
import { ErrorSchema, fail, requireCreator, type AppEnv } from "../http/http";
import type { Posts } from "../posts/posts";
import type { Publishing } from "../publish/publishing";
import type { ReviewLinks } from "../review/links";
import type { Review } from "../review/review";
import type { Sessions } from "../sessions/sessions";

const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

/** The path a draft's file is sent to. Its body is the file, not JSON, so two rules treat it apart (DR-BR-17). */
export const DRAFT_UPLOAD = /^\/deliverables\/[^/]+\/draft$/;

const DraftAcceptedSchema = z.object({ deliverableId: z.string(), state: z.enum(["checking"]), run: z.number().int() }).openapi("DraftAccepted");

const PostItemStatus = z.enum(["not_checked", "checking", "passed", "fix_needed", "unsure", "at_live_check", "waiting_for_brand", "accepted_by_brand", "objected_by_brand"]);

const PostDraftSchema = z
  .object({ fileName: z.string(), durationSec: z.number(), url: z.string(), urlExpiresAt: z.string() })
  .openapi("PostDraft");

/** One post as its creator sees it (DR-FR-25). Evidence, suggestions and the file's name are plain text. */
const CreatorPostSchema = z
  .object({
    id: z.string(),
    brandName: z.string(),
    platform: z.enum(PLATFORMS),
    state: z.enum(["no_draft", "checking", "check_failed", "results", "fully_passing", "objected", "approved", "posting", "released"]),
    deadline: z.string(),
    creatorTimeZone: z.string(),
    run: z.number().int(),
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(ITEM_KINDS),
        status: PostItemStatus,
        previousStatus: PostItemStatus.optional(),
        briefLine: z.object({ number: z.number().int(), text: z.string() }).optional(),
        evidence: z.object({ label: z.string(), text: z.string(), startSec: z.number(), endSec: z.number() }).optional(),
        checkedBy: z.enum(["exact_match", "ai_timestamp", "from_timestamps", "published_post", "platform_record"]),
        askable: z.boolean().optional(),
        askedAt: z.string().optional(),
        declined: z.boolean().optional(),
        brandNote: z.string().optional(),
        fixHint: z.string().optional(),
      }),
    ),
    brief: z.array(z.object({ number: z.number().int(), text: z.string() })),
    draft: PostDraftSchema.optional(),
    hold: z.object({
      amountMinor: z.number().int(),
      currency: z.enum(["USD"]),
      reference: z.string(),
      heldAt: z.string(),
      stage: z.enum(["held", "confirmed", "captured", "paid"]),
    }),
    payoutEmail: z.string(),
    goAhead: z
      .discriminatedUnion("state", [
        z.object({ state: z.literal("go"), endsAt: z.string() }),
        z.object({ state: z.literal("wait"), until: z.string() }),
        z.object({ state: z.enum(["confirming", "not_confirmed", "ended"]) }),
      ])
      .optional(),
    reviewWindowEndsAt: z.string().optional(),
    objectedAt: z.string().optional(),
    approvedAt: z.string().optional(),
    approvedBy: z.enum(["brand", "window"]).optional(),
    reviewLink: z.object({ url: z.string(), expiresAt: z.string(), expired: z.boolean() }).optional(),
    reviewOpenedAt: z.string().optional(),
    checkFailure: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("ours"), retrying: z.boolean(), fileName: z.string() }),
        z.object({
          kind: z.literal("file"),
          reason: z.enum(["unreadable", "format", "too_long"]),
          fileName: z.string(),
          lengthSec: z.number().optional(),
          lengthCapSec: z.number().optional(),
        }),
      ])
      .optional(),
    checkStartedAt: z.string().optional(),
    stages: z.array(z.object({ name: z.string(), status: z.enum(["done", "current", "waiting"]) })).optional(),
    releasedAt: z.string().optional(),
    releaseReason: z.enum(["deadline", "cancelled", "day_28", "fix_window_ended", "not_accepted", "ruled_not_to_pay", "hold_not_confirmed"]).optional(),
  })
  .openapi("CreatorPost");

export function registerDeliverableRoutes(
  app: OpenAPIHono<AppEnv>,
  deps: { sessions: Sessions; drafts?: Drafts; posts: Posts; review: Review; links?: ReviewLinks; publishing?: Publishing; maxBytes: number },
) {
  const { drafts, posts, review, links, publishing, maxBytes } = deps;
  const creator = requireCreator(deps.sessions);

  app.openapi(
    createRoute({
      method: "post",
      path: "/deliverables/{deliverableId}/draft",
      summary: "Send a draft: the video file is the request's body, and its check starts as a job (DR-FR-01, DR-FR-02)",
      middleware: [creator] as const,
      request: {
        params: z.object({ deliverableId: z.string().min(1).max(64) }),
        // The file's name, as plain text. It is shown and never used as a path.
        query: z.object({ fileName: z.string().max(1000).optional() }),
        body: { required: true, content: { "application/octet-stream": { schema: z.string().openapi({ type: "string", format: "binary" }) } } },
      },
      responses: {
        200: json(DraftAcceptedSchema, "The draft was taken and is being checked"),
        400: json(ErrorSchema, "No file was sent"),
        401: json(ErrorSchema, "Nobody is signed in"),
        404: json(ErrorSchema, "No such post, or it is not this creator's"),
        409: json(ErrorSchema, "The post takes no draft now: not held, released, approved, or a check is running"),
        413: json(ErrorSchema, "The file is over the size limit. Nothing of it was kept"),
        422: json(ErrorSchema, "The file cannot be checked: unreadable, not an MP4 or MOV, or too long (with its length and the cap)"),
        429: json(ErrorSchema, "A limit on drafts was reached"),
        503: json(ErrorSchema, "This service is not set up to store drafts"),
      },
    }),
    async (c) => {
      if (!drafts) return fail(c, 503, "not_set_up");
      // A length the browser states is believed only to refuse early. The stream is still cut off at the limit.
      if (Number(c.req.header("content-length") ?? 0) > maxBytes) return fail(c, 413, "file_too_large");
      const body = c.req.raw.body;
      if (!body) return fail(c, 400, "invalid", "file");

      const sent = await drafts.send(c.get("creatorId"), c.req.valid("param").deliverableId, { name: c.req.valid("query").fileName, body });
      if (!("refused" in sent)) return c.json(sent, 200);
      switch (sent.refused) {
        case "not_found":
          return fail(c, 404, "not_found");
        case "not_held":
        case "released":
        case "check_running":
        case "approved":
          return fail(c, 409, sent.refused);
        case "too_large":
          return fail(c, 413, "file_too_large");
        case "limit":
          // Which limit, and when the daily one lifts (DR-FR-09).
          return c.json({ error: { code: "draft_limit", field: sent.limit, resetsAt: sent.resetsAt?.toISOString() } }, 429);
        case "file": {
          const { failure } = sent;
          const lengths = failure.reason === "too_long" ? { lengthSec: failure.lengthSec, lengthCapSec: failure.lengthCapSec } : {};
          return c.json({ error: { code: `file_${failure.reason}`, ...lengths } }, 422);
        }
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deliverables/{deliverableId}/check/retry",
      summary: "Start the same draft's check again, after it failed on Cleared's side (DR-FR-23)",
      middleware: [creator] as const,
      request: { params: z.object({ deliverableId: z.string().min(1).max(64) }) },
      responses: {
        200: json(DraftAcceptedSchema, "The check was started again"),
        401: json(ErrorSchema, "Nobody is signed in"),
        404: json(ErrorSchema, "No such post, or it is not this creator's"),
        409: json(ErrorSchema, "There is no failed check to start again, or the post is no longer held"),
        503: json(ErrorSchema, "This service is not set up to store drafts"),
      },
    }),
    async (c) => {
      if (!drafts) return fail(c, 503, "not_set_up");
      const started = await drafts.retryCheck(c.get("creatorId"), c.req.valid("param").deliverableId);
      if (!("refused" in started)) return c.json(started, 200);
      return started.refused === "not_found" ? fail(c, 404, "not_found") : fail(c, 409, started.refused);
    },
  );

  const postId = { params: z.object({ deliverableId: z.string().min(1).max(64) }) };

  app.openapi(
    createRoute({
      method: "get",
      path: "/deliverables/{deliverableId}",
      summary: "One post at the draft check: its checklist with results, its draft, its hold and where it stands (DR-FR-25)",
      middleware: [creator] as const,
      request: postId,
      responses: {
        200: json(CreatorPostSchema, "The post"),
        401: json(ErrorSchema, "Nobody is signed in"),
        404: json(ErrorSchema, "No such post, or it is not this creator's"),
        409: json(ErrorSchema, "The post has no hold yet, so there is nothing to check a draft for"),
      },
    }),
    async (c) => {
      const post = await posts.creatorPost(c.get("creatorId"), c.req.valid("param").deliverableId);
      if (!("refused" in post)) return c.json(post, 200);
      return post.refused === "not_found" ? fail(c, 404, "not_found") : fail(c, 409, "not_held");
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deliverables/{deliverableId}/draft-url",
      summary: "A fresh address that plays the latest draft for 15 minutes (DR-FR-27)",
      middleware: [creator] as const,
      request: postId,
      responses: {
        200: json(PostDraftSchema, "The latest draft, with a new address"),
        401: json(ErrorSchema, "Nobody is signed in"),
        404: json(ErrorSchema, "No such post, it is not this creator's, or it has no draft"),
      },
    }),
    async (c) => {
      const draft = await posts.draftAddress(c.get("creatorId"), c.req.valid("param").deliverableId);
      return "refused" in draft ? fail(c, 404, draft.refused) : c.json(draft, 200);
    },
  );

  for (const what of ["ask", "withdraw"] as const) {
    app.openapi(
      createRoute({
        method: what === "ask" ? "post" : "delete",
        path: "/deliverables/{deliverableId}/items/{itemId}/ask",
        summary:
          what === "ask"
            ? "Ask the brand to accept an unsure item; it then waits for the brand (DR-FR-30)"
            : "Withdraw an ask the brand has not answered; the item is unsure again (DR-FR-31)",
        middleware: [creator] as const,
        request: { params: z.object({ deliverableId: z.string().min(1).max(64), itemId: z.string().min(1).max(64) }) },
        responses: {
          200: json(CreatorPostSchema, "The post as it now stands"),
          401: json(ErrorSchema, "Nobody is signed in"),
          404: json(ErrorSchema, "No such post or item, or the post is not this creator's"),
          409: json(ErrorSchema, "Not allowed for this item now, with the reason as the code"),
        },
      }),
      async (c) => {
        const { deliverableId, itemId } = c.req.valid("param");
        const acted = await review[what](c.get("creatorId"), deliverableId, itemId);
        if (!acted.ok) return acted.reason === "not_found" ? fail(c, 404, "not_found") : fail(c, 409, acted.reason);
        const post = await posts.creatorPost(c.get("creatorId"), deliverableId);
        return "refused" in post ? fail(c, 404, "not_found") : c.json(post, 200);
      },
    );
  }

  app.openapi(
    createRoute({
      method: "post",
      path: "/deliverables/{deliverableId}/review-link",
      summary: "Make a new review link for the brand: the old one expired, or went to the wrong person (DR-FR-45)",
      middleware: [creator] as const,
      request: postId,
      responses: {
        200: json(CreatorPostSchema, "The post, with its new link"),
        401: json(ErrorSchema, "Nobody is signed in"),
        404: json(ErrorSchema, "No such post, or it is not this creator's"),
        409: json(ErrorSchema, "The brand has nothing to do on this post's draft, so there is no link to make"),
        503: json(ErrorSchema, "This service is not set up to make links"),
      },
    }),
    async (c) => {
      const { deliverableId } = c.req.valid("param");
      const made = links ? await links.renew(c.get("creatorId"), deliverableId) : { refused: "not_set_up" as const };
      if (made !== "made") {
        return made.refused === "not_found" ? fail(c, 404, "not_found") : made.refused === "not_set_up" ? fail(c, 503, "not_set_up") : fail(c, 409, made.refused);
      }
      const post = await posts.creatorPost(c.get("creatorId"), deliverableId);
      return "refused" in post ? fail(c, 404, "not_found") : c.json(post, 200);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deliverables/{deliverableId}/draft/sample",
      summary: "A demo account checks the ready-made sample clip in place of an upload (DR-FR-50)",
      middleware: [creator] as const,
      request: postId,
      responses: {
        200: json(DraftAcceptedSchema, "The sample was taken and is being checked"),
        401: json(ErrorSchema, "Nobody is signed in"),
        403: json(ErrorSchema, "Only a demo account can use the sample"),
        404: json(ErrorSchema, "No such post, or it is not this creator's"),
        409: json(ErrorSchema, "The post takes no draft now"),
        422: json(ErrorSchema, "The sample could not be checked as a file"),
        429: json(ErrorSchema, "A limit on drafts was reached"),
        503: json(ErrorSchema, "This service has no sample clip set up"),
      },
    }),
    async (c) => {
      if (!drafts) return fail(c, 503, "not_set_up");
      const sent = await drafts.sendSample(c.get("creatorId"), c.req.valid("param").deliverableId);
      if (!("refused" in sent)) return c.json(sent, 200);
      switch (sent.refused) {
        case "not_found":
          return fail(c, 404, "not_found");
        case "not_demo":
          return fail(c, 403, "not_demo");
        case "not_set_up":
          return fail(c, 503, "not_set_up");
        case "limit":
          return c.json({ error: { code: "draft_limit", field: sent.limit, resetsAt: sent.resetsAt?.toISOString() } }, 429);
        case "file":
          return c.json({ error: { code: `file_${sent.failure.reason}` } }, 422);
        case "too_large":
          return fail(c, 422, "file_too_large");
        default:
          return fail(c, 409, sent.refused);
      }
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deliverables/{deliverableId}/go-ahead",
      summary: "Ask for the go-ahead to publish, with the link of the video on the creator's channel (PT-FR-01 to PT-FR-07)",
      middleware: [creator] as const,
      request: {
        ...postId,
        body: { required: true, content: { "application/json": { schema: z.object({ videoUrl: z.string().max(4000) }) } } },
      },
      responses: {
        200: json(CreatorPostSchema, "The post, with the money path's answer: go until a time, wait until a time, or not confirmed"),
        400: json(ErrorSchema, "The link is not a link to a YouTube video"),
        401: json(ErrorSchema, "Nobody is signed in"),
        404: json(ErrorSchema, "No such post, or it is not this creator's"),
        409: json(ErrorSchema, "No go-ahead: the draft is not approved, the video is not the approved file on the creator's channel, YouTube must be reconnected, or the money path refused, each with its own code"),
        503: json(ErrorSchema, "YouTube could not be read, or this service is not set up to read it. Try again"),
      },
    }),
    async (c) => {
      if (!publishing) return fail(c, 503, "not_set_up");
      const { deliverableId } = c.req.valid("param");
      const asked = await publishing.askGoAhead(c.get("creatorId"), deliverableId, c.req.valid("json").videoUrl);
      if ("refused" in asked) {
        switch (asked.refused) {
          case "not_found":
            return fail(c, 404, "not_found");
          case "not_a_youtube_link":
            return fail(c, 400, "not_a_youtube_link", "videoUrl");
          case "youtube_unavailable":
            return fail(c, 503, "youtube_unavailable");
          case "money":
            return fail(c, 409, asked.reason);
          default:
            return fail(c, 409, asked.refused);
        }
      }
      const post = await posts.creatorPost(c.get("creatorId"), deliverableId);
      return "refused" in post ? fail(c, 404, "not_found") : c.json(post, 200);
    },
  );
}
