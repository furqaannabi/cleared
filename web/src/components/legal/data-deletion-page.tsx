import { CONTACT_EMAIL } from "@/lib/legal/contact";
import { DELETION_BY_EMAIL } from "@/lib/legal/periods";
import { LegalPage, type LegalSection } from "./legal-page";

function sections(): LegalSection[] {
  const byEmail = `Email ${CONTACT_EMAIL} from the Google email you signed in with, or name it in your email, and ask us to delete your account. It is done ${DELETION_BY_EMAIL}.`;
  return [
    {
      id: "how-to-delete",
      heading: "How to delete your account",
      blocks: [
        "In Sponing, open Settings and choose Delete account. While a deal is still open (a post is held, a payout is on its way, or a brand hasn’t answered), deleting is refused and Settings lists what has to finish first.",
        `Or by email: ${byEmail}`,
      ],
    },
    {
      id: "what-is-deleted",
      heading: "What is deleted, and what is kept",
      blocks: [
        // LG-FR-13 (1.1): in Settings' words (ST-FR-10, 1.3).
        "Your profile, your connected accounts, your drafts, and each deal’s brief, checklist and check results are deleted, and brands’ links to your deals stop working.",
        "Sponing keeps the payment records it must (amounts, dates and PayPal references), with your name and emails removed. Signing in again starts a new, empty account.",
      ],
    },
    {
      id: "removing-access",
      heading: "Removing Sponing from Google or Instagram",
      blocks: ["Removing Sponing in your Google account’s or Instagram’s own settings stops Sponing reading that account."],
    },
    {
      id: "brands",
      heading: "If you’re a brand",
      blocks: [`Brands don’t have an account. To have your email removed, email ${CONTACT_EMAIL}.`],
    },
  ];
}

/**
 * `/data-deletion`: how to delete an account (Settings first, then by email),
 * what is deleted and what is kept, removing access in Google or Instagram,
 * and brands.
 *
 * @see docs/specs/legal-pages-frd.md LG-FR-13 (1.1)
 */
export function DataDeletionPage() {
  return <LegalPage title="Deleting your data" sections={sections()} />;
}
