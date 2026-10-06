import { createApiClient } from "./client";

/** The API base URL: `NEXT_PUBLIC_API_BASE_URL`, or same-origin `/api` (where dev mocks answer). */
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

/** The app's one API client. Components call this, never `fetch` with a path. */
export const api = createApiClient({ baseUrl: apiBaseUrl });

export type { ApiError, ApiResult } from "./client";
