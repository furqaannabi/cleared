/**
 * How long Cleared keeps each thing, in the privacy policy's words, and how
 * fast a deletion requested by email is done: Furqaan's answers (AH-FR-22,
 * AH-FR-24). A change to what the backend keeps changes these in the same
 * change (LG-BR-01).
 *
 * @see docs/specs/legal-pages-frd.md LG-FR-08, LG-FR-13 (1.1)
 */
export const KEPT: readonly string[] = [
  "Drafts, and the speech, on-screen text and frames read from them: 30 days after the post ends (paid, its hold returned, or closed).",
  "A live Reel’s video, fetched to check it: only until it’s matched to your draft, a few minutes.",
  "The brief, checklist, notes, check results and their evidence, and the brand’s email: while your account exists.",
  "Access to YouTube and Instagram: until you disconnect, access ends, or you delete your account.",
  "Payment records (amounts, dates and PayPal references): for as long as Cleared runs, with no name or email once your account is deleted.",
  "Your account, after you delete it: deleted at once; its files within 24 hours.",
  "Sessions: 14 days after last use.",
  "Server logs: 30 days; they hold ids only.",
];

/** How fast a deletion requested by email is done (AH-FR-22). */
export const DELETION_BY_EMAIL = "within 30 days";
