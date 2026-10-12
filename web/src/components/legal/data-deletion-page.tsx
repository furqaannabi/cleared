import { CONTACT_EMAIL } from "@/lib/legal/flag";
import { period } from "@/lib/legal/periods";
import { LegalPage, type LegalSection } from "./legal-page";

/** ST-FR-12: whether Delete account is switched on in Settings. */
const ACCOUNT_REMOVAL = process.env.NEXT_PUBLIC_ACCOUNT_REMOVAL === "enabled";

function sections(removal: boolean): LegalSection[] {
  const byEmail = `Email ${CONTACT_EMAIL} from the Google email you signed in with, or name it in your email, and ask us to delete your account. It is done ${period("deletion")}.`;
  return [
    {
      id: "how-to-delete",
      heading: "How to delete your account",
      blocks: removal
        ? [
            "In Cleared, open Settings and choose Delete account. While a deal is still open (a post is held, a payout is on its way, or a brand hasn’t answered), deleting is refused and Settings lists what has to finish first.",
            `Or by email: ${byEmail}`,
          ]
        : [byEmail],
    },
    {
      id: "what-is-deleted",
      heading: "What is deleted, and what is kept",
      blocks: [
        "Your profile, your connected accounts and your drafts are deleted.",
        "Cleared keeps the payment records it must (amounts, dates and PayPal references), with your name and email removed.",
      ],
    },
    {
      id: "removing-access",
      heading: "Removing Cleared from Google or Instagram",
      blocks: ["Removing Cleared in your Google account’s or Instagram’s own settings stops Cleared reading that account."],
    },
    {
      id: "brands",
      heading: "If you’re a brand",
      blocks: [`Brands don’t have an account. To have your email removed, email ${CONTACT_EMAIL}.`],
    },
  ];
}

/**
 * `/data-deletion`: how to delete an account (Settings when Delete account is
 * on, otherwise by email), what is deleted and what is kept, removing access
 * in Google or Instagram, and brands.
 *
 * @param removal - whether Delete account is on in Settings (the build flag; tests)
 * @see docs/specs/legal-pages-frd.md LG-FR-13
 */
export function DataDeletionPage({ removal = ACCOUNT_REMOVAL }: { removal?: boolean }) {
  return <LegalPage title="Deleting your data" sections={sections(removal)} />;
}
