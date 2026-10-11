import type { components } from "contract";
import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";

type PostKeepingEmail = components["schemas"]["PostKeepingEmail"];
type Platform = keyof typeof PLATFORM_LABEL;

/**
 * After a new PayPal email is saved: the payouts already with PayPal, which
 * keep the email they were sent to. Each post is named by its brand and, when
 * the deals list knows it, its platform.
 *
 * @param posts - the API's `postsKeepingEmail`
 * @param deals - the creator's deals, for each post's platform
 * @returns the note's lead and one line per post, or null when there are none
 * @see docs/specs/creator-invite-frd.md IN-FR-12 (1.3)
 */
export function keepingEmailNote(posts: PostKeepingEmail[], deals: { id: string; deliverables: { id: string; platform: Platform }[] }[]) {
  if (!posts.length) return null;
  const name = (p: PostKeepingEmail) => {
    const platform = deals.find((d) => d.id === p.dealId)?.deliverables.find((d) => d.id === p.deliverableId)?.platform;
    return platform ? `${p.brandName} · ${PLATFORM_LABEL[platform]}` : p.brandName;
  };
  if (posts.length === 1) return { lead: `Saved. A payout already with PayPal still goes to ${posts[0].email}:`, lines: [name(posts[0])] };
  return { lead: "Saved. Payouts already with PayPal still go to the email they were sent to:", lines: posts.map((p) => `${name(p)}: ${p.email}`) };
}
