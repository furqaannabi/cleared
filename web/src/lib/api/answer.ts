import { z } from "zod";

/**
 * `rejected`: the API refused a change (the item changed, say); `read_limit`:
 * a daily limit on reading briefs (BC-FR-24); `draft_limit`: a limit on
 * drafts (DC-FR-53); `cancelled`: the creator stopped an upload (DC-FR-45);
 * the others are as for reads.
 */
export type ApiError = "not_found" | "invalid_response" | "unavailable" | "rejected" | "signed_out" | "read_limit" | "draft_limit" | "cancelled";

/** At a limit: which one, and when a daily one lifts (BC-FR-24, DS-FR-28, DC-FR-53). */
export type ApiLimit = { field: "creator" | "overall" | "post"; resetsAt?: string };

/**
 * `code`: the contract's reason for a refusal, when the API gave one (e.g.
 * `amount_above_maximum`, IN-FR-06); `file`: a too-long draft's length and
 * the cap (DC-FR-08).
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError; code?: string; limit?: ApiLimit; file?: { lengthSec: number; lengthCapSec: number } };

// The contract's error body: its code, and the details some refusals carry.
const errorSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(64),
    field: z.string().max(64).optional(),
    resetsAt: z.iso.datetime({ offset: true }).optional(),
    lengthSec: z.number().nonnegative().optional(),
    lengthCapSec: z.number().positive().optional(),
  }),
});
const LIMITS = { read_limit: ["creator", "overall"], draft_limit: ["post", "overall"] } as const;

/**
 * Reads one answer from the API the same way for every call: the status
 * decides the outcome, a refusal keeps the contract's code and details, and
 * a success is parsed with its schema, never shown in part.
 *
 * @param status - the HTTP status
 * @param json - the parsed body, or null when there was none
 * @param schema - the success body's schema
 * @see docs/decisions/2026-10-06-schema-validation-zod.md
 */
export function readAnswer<S extends z.ZodType>(status: number, json: unknown, schema: S): ApiResult<z.infer<S>> {
  // DC-FR-38: a deal that doesn't exist and one that isn't yours look the same.
  // SI-FR-06, SI-FR-07: nobody is signed in, or the session ended.
  if (status === 401) return { ok: false, error: "signed_out" };
  if (status === 404 || status === 403) return { ok: false, error: "not_found" };
  const body = errorSchema.safeParse(json);
  const e = body.success ? body.data.error : null;
  if (status === 400 || status === 409 || status === 413 || status === 422) {
    if (!e) return { ok: false, error: "rejected" };
    const file = e.lengthSec !== undefined && e.lengthCapSec !== undefined ? { file: { lengthSec: e.lengthSec, lengthCapSec: e.lengthCapSec } } : {};
    return { ok: false, error: "rejected", code: e.code, ...file };
  }
  if (status === 429) {
    const fields: readonly string[] | undefined = e && e.code in LIMITS ? LIMITS[e.code as keyof typeof LIMITS] : undefined;
    if (!e || !fields || !e.field || !fields.includes(e.field)) return { ok: false, error: "unavailable" };
    return { ok: false, error: e.code as "read_limit" | "draft_limit", limit: { field: e.field as ApiLimit["field"], ...(e.resetsAt ? { resetsAt: e.resetsAt } : {}) } };
  }
  if (status < 200 || status >= 300) return { ok: false, error: "unavailable" };
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: "invalid_response" };
}
