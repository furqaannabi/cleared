const NEEDS: Record<string, string> = {
  youtube_not_connected: "Connect YouTube",
  instagram_not_connected: "Connect Instagram",
  paypal_email_missing: "Add your PayPal email",
};

/**
 * The words for a refused Create link or Send updated terms when something
 * isn't in place, from the API's code. Null for any other refusal, which
 * keeps "We couldn't save that." with Try again (IN-FR-15).
 *
 * @param code - the refusal's code, e.g. "instagram_not_connected"
 * @param update - whether the refused action was Send updated terms
 * @see docs/specs/creator-invite-frd.md IN-FR-23
 */
export function linkRefusal(code: string | undefined, update: boolean): string | null {
  if (code === "terms_incomplete") return "Some terms aren’t finished. Check each post’s amount and deadline.";
  const need = code ? NEEDS[code] : undefined;
  if (!need) return null;
  return `${need} before you ${update ? "send the updated terms" : "create the link"}.`;
}
