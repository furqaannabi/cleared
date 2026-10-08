import { apiBaseUrl } from "@/lib/api";

/**
 * Mock only: ends a post's review window now, so a window that ran out can
 * be shown (RW-FR-20). Never part of the real API.
 *
 * @param deliverableId - the post
 * @returns whether the post was in its window
 */
export async function endReviewWindow(deliverableId: string): Promise<boolean> {
  const res = await fetch(`${apiBaseUrl}/__demo/review/${encodeURIComponent(deliverableId)}/end-window`, { method: "POST" });
  return res.ok;
}
