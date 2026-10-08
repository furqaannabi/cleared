import type { ApiResult } from "@/lib/api";

/**
 * Runs one change against the API under a key (a field), and reports whether
 * it saved. A failed save is shown beside that field with Try again
 * (IN-FR-15); it is never shown as saved.
 */
export type Save = <T>(key: string, call: () => Promise<ApiResult<T>>, onSaved: (data: T) => void) => Promise<boolean>;

/** The fields whose last save failed, each with the change to try again. */
export type SaveProblems = Record<string, () => void>;
