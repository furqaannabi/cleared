import type { ApiResult } from "@/lib/api";

/**
 * Runs one change against the API under a key (a field), and reports whether
 * it saved. A failed save is shown beside that field with Try again
 * (IN-FR-15); it is never shown as saved. A refusal the field explains itself
 * (`explained` answers true, e.g. an amount over the limit, IN-FR-06) gets no
 * Try again, since trying again would be refused the same way.
 */
export type Save = <T>(
  key: string,
  call: () => Promise<ApiResult<T>>,
  onSaved: (data: T) => void,
  explained?: (failure: Extract<ApiResult<T>, { ok: false }>) => boolean,
) => Promise<boolean>;

/** The fields whose last save failed, each with the change to try again. */
export type SaveProblems = Record<string, () => void>;
