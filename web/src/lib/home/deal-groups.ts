import type { z } from "zod";
import type { dealSummarySchema } from "@/lib/api/schemas";
import { postStepLabel } from "@/lib/deliverable/deal-steps";
import type { PaymentRow } from "./payment-row";
import { postWord } from "./post-words";

export type DealSummary = z.infer<typeof dealSummarySchema>;
type PostState = DealSummary["deliverables"][number]["state"];

/** One deal on home: its brand, where it opens, and each post's step (or the deal's status line before agreeing). */
export interface HomeDeal {
  id: string;
  brandName: string;
  href: string;
  status: string;
  posts: { id: string; platform: DealSummary["deliverables"][number]["platform"]; post: string; state: PostState; words: string; stuck?: true }[];
}

export interface DealGroup {
  name: "Needs you" | "Under way" | "Finished";
  deals: HomeDeal[];
}

const NEEDS_YOU_STEPS = new Set(["checklist", "invite", "changes_requested"]);
// Every post ended: paid, its hold released, approved and never paid, or closed without a hold.
const ENDED = new Set<PostState>(["paid", "released", "approved_not_paid", "closed"]);
const STUCK_WORDS: Partial<Record<NonNullable<PaymentRow["payout"]>["state"], string>> = {
  failed: "Payout didn’t go through",
  unclaimed: "Waiting for you to accept the payout",
};

/**
 * The creator's deals in three groups, in the API's order within each:
 * Needs you (the deal is at a step that is the creator's, the API says a post
 * waits on them, or a payout failed or wasn't claimed), Under way, Finished.
 * A closed post says why. A group with no deals is left out.
 *
 * @param deals - the creator's deals, as the rail has them
 * @param payments - the payment rows, for stuck payouts; empty when not loaded
 * @see docs/specs/creator-home-frd.md HM-FR-15 (1.3)
 */
export function dealGroups(deals: DealSummary[], payments: PaymentRow[]): DealGroup[] {
  const stuckWords = new Map(
    payments.flatMap((p) => {
      const words = p.stage === "captured" && p.payout ? STUCK_WORDS[p.payout.state] : undefined;
      return words ? [[p.deliverableId, words] as const] : [];
    }),
  );
  const groups: DealGroup[] = [
    { name: "Needs you", deals: [] },
    { name: "Under way", deals: [] },
    { name: "Finished", deals: [] },
  ];
  for (const d of deals) {
    const agreed = !d.step || d.step === "agreed";
    const needsYou = (d.step && NEEDS_YOU_STEPS.has(d.step)) || (agreed && d.deliverables.some((p) => p.needsCreator)) || d.deliverables.some((p) => stuckWords.has(p.id));
    const finished = agreed && d.deliverables.length > 0 && d.deliverables.every((p) => ENDED.has(p.state));
    groups[needsYou ? 0 : finished ? 2 : 1].deals.push({
      id: d.id,
      brandName: d.brandName,
      href: `/deals/${encodeURIComponent(d.id)}`,
      status: d.status,
      posts: agreed
        ? d.deliverables.map((p) => {
            const stuck = stuckWords.get(p.id);
            const words = stuck ?? postStepLabel(p);
            return { id: p.id, platform: p.platform, post: postWord(p.platform), state: p.state, words, ...(stuck ? { stuck: true as const } : {}) };
          })
        : [],
    });
  }
  return groups.filter((g) => g.deals.length > 0);
}
