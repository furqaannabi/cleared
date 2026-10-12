import type { ApiError } from "@/lib/api";
import { sessionEnded } from "@/lib/brand-deal/session-ended";

/**
 * What a cancel that didn't go through says, kept beside the open card with
 * the note: the session ended (a 401), worded for each side, or the request
 * didn't get through.
 *
 * @param error - why the request failed
 * @param side - whose page this is
 * @param creatorName - the creator, named in the brand's line
 * @see docs/specs/cancel-frd.md CN-FR-08, CN-FR-19
 */
export function cancelFailure(error: ApiError, side: "creator" | "brand", creatorName?: string): string {
  if (error !== "signed_out") return "That didn’t go through. Try again.";
  return side === "brand" ? sessionEnded(creatorName) : "You’ve been signed out. Sign in again to carry on.";
}
