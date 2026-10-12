import { LegalPage, type LegalSection } from "./legal-page";

const SECTIONS: LegalSection[] = [
  {
    id: "what-cleared-is",
    heading: "What Cleared is",
    blocks: [
      "Cleared runs a sponsorship deal that a creator and a brand have already agreed. It is not a marketplace, and it is not a party to their agreement.",
      "Cleared is a hackathon project on PayPal’s sandbox. No real money moves.",
    ],
  },
  {
    id: "how-the-money-works",
    heading: "How the money works",
    blocks: [
      {
        list: [
          "Each deliverable is one post on one platform, with its own amount, deadline, checklist and hold. A hold is $20 to $10,000.",
          "Both sides agree the same checklist before any money is held. The checklist is the only thing a post is judged against.",
          "The brand has 48 hours from a fully passing draft to approve it or object. Silence approves a fully passing draft, and nothing else.",
          "The creator gets the go-ahead to publish only once PayPal re-confirms the hold. The go-ahead lasts 48 hours.",
          "The held money is taken only after the published post passes its live check, and never more than was held.",
          "A missed deadline or a cancelled deal gives the hold back to the brand. Either side can cancel until the creator has a go-ahead.",
          "A hold that hasn’t been taken or given back by day 28 is given back to the brand.",
          "Cleared’s fee is 5% of the deliverable’s amount, taken from the creator’s payout, in whole cents rounded down. PayPal’s own charges come out of that fee.",
        ],
      },
    ],
  },
  {
    id: "the-ai",
    heading: "The AI, and its limits",
    blocks: [
      "AI reads the brief and checks the draft, and gives a finding with evidence for each item. Our code checks that evidence before it counts. Anything unsure goes to a person. The AI never moves money.",
      "The AI can be wrong. That is why every finding shows its evidence, and why either side can ask about an item or object to it.",
    ],
  },
  {
    id: "platforms",
    heading: "YouTube and Instagram",
    blocks: [
      "Each side keeps to YouTube’s and Instagram’s rules, including labelling paid partnerships. On Instagram the paid-partnership label is always checked by a person.",
    ],
  },
  {
    id: "what-we-cant-promise",
    heading: "What we can’t promise",
    blocks: [
      "We can’t promise that YouTube, Instagram or PayPal are always available, or that PayPal accepts every hold, capture or payout. When one of them fails, Cleared says why and what happens next.",
    ],
  },
  {
    id: "your-account",
    heading: "Your account",
    blocks: ["You can delete your account at any time; see Deleting your data for how, and what is kept."],
  },
];

/**
 * `/terms`: what Cleared is and isn't, the money rules in plain words, the AI
 * and its limits, the platforms' rules, what Cleared can't promise, and the
 * account.
 *
 * @see docs/specs/legal-pages-frd.md LG-FR-11, LG-FR-12
 */
export function TermsPage() {
  return <LegalPage title="Terms" sections={SECTIONS} />;
}
