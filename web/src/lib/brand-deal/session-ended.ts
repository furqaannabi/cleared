/**
 * What the brand reads when its link session ended during an action. Nothing
 * on the page is cleared, so the same action can be tried again after opening
 * the link in another tab.
 *
 * @param creatorName - who sent the link, when known
 * @see docs/specs/brand-review-frd.md RW-FR-31
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-29
 */
export function sessionEnded(creatorName?: string): string {
  return `Your access to this deal has ended. Open the link ${creatorName ? `${creatorName} sent you` : "you were sent"}, then try again here.`;
}
