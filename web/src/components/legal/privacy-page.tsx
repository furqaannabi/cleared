import { KEPT } from "@/lib/legal/periods";
import { LegalPage, type LegalSection } from "./legal-page";

const SECTIONS: LegalSection[] = [
  {
    id: "what-we-collect",
    heading: "What we collect, and why",
    blocks: [
      "From creators:",
      {
        list: [
          "Your name and email from Google, to sign you in.",
          "Read-only access to your YouTube channel and, if you connect it, your Instagram professional account, with the account’s name, to check your post once it is published.",
          "The drafts you upload, and what is said, written on screen and shown in them, to check each draft against its checklist.",
          "The brief you paste, to turn it into a checklist.",
          "Your PayPal email, to pay you.",
        ],
      },
      "From brands:",
      {
        list: [
          "The email you choose to give, to send you the two notices after a post is live.",
          "The PayPal references for your holds.",
        ],
      },
      "From both sides: the deal’s terms, checklist, notes and decisions, and the PayPal reference for every hold, capture and payout, so both of you can see what happened to the money.",
    ],
  },
  {
    id: "what-we-never-do",
    heading: "What we never do",
    blocks: [
      {
        list: [
          "See or store your Google, Instagram or PayPal password.",
          "Post, edit or delete anything on your YouTube or Instagram. Our access is read-only.",
          "Sell your data or show you ads.",
          "Let an AI move money. AI gives findings with evidence; our own code checks the evidence and decides.",
        ],
      },
      "Your account tokens are encrypted and never sent to your browser. Drafts are private: only the two sides of their deal can see them, through short-lived links.",
    ],
  },
  {
    id: "who-processes-it",
    heading: "Who else handles it",
    blocks: [
      {
        list: [
          "PayPal: holds, capture and payouts (the sandbox only; no real money moves).",
          "Amazon Web Services: hosting, the database, file storage and encryption, and Amazon Bedrock, which reads briefs and checks drafts.",
          "Google: signing in, and reading your YouTube channel.",
          "Meta: reading your Instagram account.",
          "Resend: the brand’s two emails.",
          "Vercel: hosting this website.",
        ],
      },
    ],
  },
  {
    id: "how-long",
    heading: "How long we keep it",
    blocks: [
      {
        list: [...KEPT],
      },
    ],
  },
  {
    id: "your-choices",
    heading: "Your choices",
    blocks: [
      {
        list: [
          "Stop Sponing reading YouTube or Instagram by removing Sponing in your Google account’s or Instagram’s own settings.",
          "Delete your account: see Deleting your data.",
          "Ask what we hold about you, by email.",
        ],
      },
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    blocks: [
      "One cookie keeps a signed-in creator signed in, and one keeps a brand in the deal it opened from its link. Scripts on the page can’t read them. We use no tracking or advertising cookies.",
    ],
  },
];

/**
 * `/privacy`: what Sponing collects and why, what it never does, who handles
 * it, how long it is kept, the reader's choices and cookies.
 *
 * @see docs/specs/legal-pages-frd.md LG-FR-05 to LG-FR-10
 */
export function PrivacyPage() {
  return <LegalPage title="Privacy policy" sections={SECTIONS} />;
}
