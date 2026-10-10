/** The creator's invite: terms, the brand's email and the brand's link (deal set-up spec DS-FR-29 to DS-FR-33). */
import type { Cancelling } from "../cancel/cancelling";
import { createRoute, z, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { PLATFORMS } from "../deals/deals";
import { ErrorSchema, fail, requireCreator, type AppEnv } from "../http/http";
import type { Invite, Invites, LinkRefused, TermsRefused } from "../invites/invites";
import { cents } from "../invites/terms";
import type { Sessions } from "../sessions/sessions";
import { HoldSchema, NoteSchema, NoteTextSchema, CancelBodySchema, CancelSchema, CancelledSchema } from "./shared";

const json = <Schema extends z.ZodType>(schema: Schema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});
const body = <Schema extends z.ZodType>(schema: Schema) => ({
  body: { required: true, content: { "application/json": { schema } } },
});

/** US dollars as a decimal string with two places, never a number (DS-BR-12). */
const AmountSchema = z.string().regex(/^\d{1,7}\.\d{2}$/);
/** Days after the hold, 1 to 21: the cap on a deadline (PRODUCT.md). */
const DeadlineDaysSchema = z.number().int().min(1).max(21);

const InviteSchema = z
  .object({
    dealId: z.string(),
    brandName: z.string(),
    step: z.enum(["invite", "waiting_for_brand", "changes_requested", "agreed"]),
    posts: z.array(
      z.object({
        deliverableId: z.string(),
        platform: z.enum(PLATFORMS),
        itemCount: z.number().int(),
        amount: AmountSchema.optional(),
        deadlineDays: DeadlineDaysSchema.optional(),
        hold: HoldSchema.optional(),
        cancel: CancelSchema.optional(),
        cancelled: CancelledSchema.optional(),
      }),
    ),
    brandEmail: z.email().optional(),
    version: z.number().int().optional(),
    link: z.object({ url: z.string(), expiresAt: z.string(), expired: z.boolean() }).optional(),
    notes: z.array(NoteSchema).optional(),
  })
  .openapi("Invite");

/** Whether `name` is a timezone this service can tell the time in, as a browser reports its own. */
function isTimezone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

const id = z.string().min(1).max(64);
const dealId = { params: z.object({ dealId: id }) };

const refusals = {
  400: json(ErrorSchema, "The request is not valid"),
  401: json(ErrorSchema, "Nobody is signed in"),
  404: json(ErrorSchema, "No such deal, it is not this creator's, or it has not reached the invite step"),
  409: json(ErrorSchema, "Not allowed at this point of the deal"),
};
const responses = { 200: json(InviteSchema, "The invite as it now stands"), ...refusals };
const linkResponses = { ...responses, 503: json(ErrorSchema, "This service is not set up to make links") };

export function registerInviteRoutes(app: OpenAPIHono<AppEnv>, deps: { sessions: Sessions; invites: Invites; cancelling?: Pick<Cancelling, "cancel"> }) {
  const { invites } = deps;
  const creator = requireCreator(deps.sessions);

  /** Answers with the invite as changed, or with why a change to the terms was refused. */
  const terms = (c: Context<AppEnv>, changed: Invite | TermsRefused) => {
    if (!("refused" in changed)) return c.json(changed, 200);
    switch (changed.refused) {
      case "not_found":
        return fail(c, 404, "not_found");
      case "not_editable":
        return fail(c, 409, "not_editable");
      case "amount_below_minimum":
      case "amount_above_maximum":
        // The reason is the money path's own, for the page to show beside the amount (MP-FR-09).
        return fail(c, 400, changed.refused, "amount");
    }
  };
  /** Answers with the invite as changed, or with why making or changing the link was refused. */
  const link = (c: Context<AppEnv>, changed: Invite | LinkRefused) => {
    if (!("refused" in changed)) return c.json(changed, 200);
    switch (changed.refused) {
      case "not_found":
        return fail(c, 404, "not_found");
      case "not_at_invite":
      case "no_link":
      case "no_changes_asked":
      case "youtube_not_connected":
      case "paypal_email_missing":
        return fail(c, 409, changed.refused);
      case "terms_incomplete":
        return fail(c, 409, "terms_incomplete", `posts.${changed.index}`);
      case "not_set_up":
        return fail(c, 503, "not_set_up");
    }
  };

  app.openapi(
    createRoute({
      method: "get",
      path: "/deals/{dealId}/invite",
      summary: "The deal's terms and the brand's link (DS-FR-29, DS-FR-32)",
      middleware: [creator] as const,
      request: dealId,
      responses: { 200: responses[200], 401: refusals[401], 404: refusals[404] },
    }),
    async (c) => {
      const invite = await invites.get(c.get("creatorId"), c.req.valid("param").dealId);
      return invite ? c.json(invite, 200) : fail(c, 404, "not_found");
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/deals/{dealId}/invite/posts/{deliverableId}",
      summary: "Set a post's amount, its deadline, or both (DS-FR-29)",
      middleware: [creator] as const,
      request: {
        params: z.object({ dealId: id, deliverableId: id }),
        ...body(z.object({ amount: AmountSchema.optional(), deadlineDays: DeadlineDaysSchema.optional() })),
      },
      responses,
    }),
    async (c) => {
      const { dealId: deal, deliverableId: post } = c.req.valid("param");
      const sent = c.req.valid("json");
      const change = {
        ...(sent.amount === undefined ? {} : { amountCents: cents(sent.amount) }),
        ...(sent.deadlineDays === undefined ? {} : { deadlineDays: sent.deadlineDays }),
      };
      return terms(c, await invites.setPostTerms(c.get("creatorId"), deal, post, change));
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals/{dealId}/invite/posts/{deliverableId}/cancel",
      summary: "Cancel one post of the deal, held or not, with an optional note in plain text; the answer is the invite (PT-FR-28 to PT-FR-30)",
      middleware: [creator] as const,
      request: { params: z.object({ dealId: id, deliverableId: id }), ...body(CancelBodySchema) },
      responses: { ...responses, 409: json(ErrorSchema, "Not cancelled, with the money path's reason as the code. `already_cancelled` says by whom") },
    }),
    async (c) => {
      const { dealId: deal, deliverableId: post } = c.req.valid("param");
      const before = await invites.get(c.get("creatorId"), deal);
      if (!before || !deps.cancelling) return fail(c, 404, "not_found");
      const done = await deps.cancelling.cancel("creator", deal, post, c.req.valid("json").note);
      if (!done.ok) {
        if (done.reason === "not_found") return fail(c, 404, "not_found");
        return done.reason === "already_cancelled" ? c.json({ error: { code: done.reason, by: done.by } }, 409) : fail(c, 409, done.reason);
      }
      const after = await invites.get(c.get("creatorId"), deal);
      return after ? c.json(after, 200) : fail(c, 404, "not_found");
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/deals/{dealId}/invite",
      summary: "Keep the brand's email, or take it away with null; nothing is sent to it (DS-FR-30)",
      middleware: [creator] as const,
      request: { ...dealId, ...body(z.object({ brandEmail: z.email().max(254).nullable() })) },
      responses,
    }),
    async (c) => terms(c, await invites.setBrandEmail(c.get("creatorId"), c.req.valid("param").dealId, c.req.valid("json").brandEmail)),
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals/{dealId}/invite/link",
      summary: "Make the brand's link; the terms are saved as a version and the deal waits for the brand (DS-FR-31)",
      middleware: [creator] as const,
      // The creator's timezone, as their browser reports it. A deadline's date is read in it.
      request: { ...dealId, ...body(z.object({ timezone: z.string().min(1).max(64).refine(isTimezone) })) },
      responses: linkResponses,
    }),
    async (c) => link(c, await invites.createLink(c.get("creatorId"), c.req.valid("param").dealId, c.req.valid("json").timezone)),
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals/{dealId}/invite/link/renew",
      summary: "Make a new link: the old one is turned off and a new one returned (DS-FR-33)",
      middleware: [creator] as const,
      request: dealId,
      responses: { 200: responses[200], 401: refusals[401], 404: refusals[404], 409: refusals[409], 503: linkResponses[503] },
    }),
    async (c) => link(c, await invites.renewLink(c.get("creatorId"), c.req.valid("param").dealId)),
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/deals/{dealId}/invite/link",
      summary: "Change terms: the link is turned off and the deal goes back to the invite step (DS-FR-33)",
      middleware: [creator] as const,
      request: dealId,
      responses: { 200: responses[200], 401: refusals[401], 404: refusals[404], 409: refusals[409], 503: linkResponses[503] },
    }),
    async (c) => link(c, await invites.turnOffLink(c.get("creatorId"), c.req.valid("param").dealId)),
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/deals/{dealId}/notes/{noteId}/reply",
      summary: "Reply to one of the brand's notes, in plain text (DS-FR-39)",
      middleware: [creator] as const,
      request: { params: z.object({ dealId: id, noteId: id }), ...body(z.object({ reply: NoteTextSchema })) },
      responses,
    }),
    async (c) => {
      const { dealId: deal, noteId: note } = c.req.valid("param");
      return terms(c, await invites.replyToNote(c.get("creatorId"), deal, note, c.req.valid("json").reply));
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/deals/{dealId}/invite/send",
      summary: "Send updated terms: a new version to the same link, which gets 7 more days (DS-FR-40)",
      middleware: [creator] as const,
      request: dealId,
      responses: { 200: responses[200], 401: refusals[401], 404: refusals[404], 409: refusals[409], 503: linkResponses[503] },
    }),
    async (c) => link(c, await invites.sendUpdatedTerms(c.get("creatorId"), c.req.valid("param").dealId)),
  );
}
