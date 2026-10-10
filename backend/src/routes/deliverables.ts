/** The creator's post at the draft check (draft check and review spec DR-FR-01 to DR-FR-09). */
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Drafts } from "../drafts/drafts";
import { ErrorSchema, fail, requireCreator, type AppEnv } from "../http/http";
import type { Sessions } from "../sessions/sessions";

const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

/** The path a draft's file is sent to. Its body is the file, not JSON, so two rules treat it apart (DR-BR-17). */
export const DRAFT_UPLOAD = /^\/deliverables\/[^/]+\/draft$/;

const DraftAcceptedSchema = z.object({ deliverableId: z.string(), state: z.enum(["checking"]), run: z.number().int() }).openapi("DraftAccepted");

export function registerDeliverableRoutes(app: OpenAPIHono<AppEnv>, deps: { sessions: Sessions; drafts?: Drafts; maxBytes: number }) {
  const { drafts, maxBytes } = deps;
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
}
