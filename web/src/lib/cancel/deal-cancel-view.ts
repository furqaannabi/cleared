import type { Deliverable } from "@/lib/deliverable/types";
import { formatAmount } from "@/lib/invite/amount";

const NAME: Record<Deliverable["platform"], string> = { youtube_video: "YouTube video", youtube_short: "YouTube Short", instagram_reel: "Instagram Reel" };

/** One post of the deal, as either page knows it. */
export interface DealCancelPost {
  deliverableId: string;
  platform: Deliverable["platform"];
  /** The API's decimal amount. */
  amount: string;
  /** Whether its money is held now (otherwise nothing is held yet). */
  held: boolean;
  cancel: Deliverable["cancel"];
}

/** One card on the deal's confirmation. */
export interface DealCancelCard {
  deliverableId: string;
  name: string;
  amount: string;
  line: string;
  stays: boolean;
}

/**
 * Cancelling the whole deal (design B): a card per post saying what happens
 * to it (its money goes back, it closes, or it stays and why), the button
 * only while at least one post can be cancelled, and the confirm naming how
 * many. Posts already finished aren't listed. The API decides each post
 * (CN-BR-01); the page sends one cancel per post (CN-BR-02).
 *
 * @param posts - the deal's posts
 * @param who - whose page, and both names
 * @see docs/specs/cancel-frd.md CN-FR-02, CN-FR-06; design/cancel/option-b.html
 */
export function dealCancelView(posts: DealCancelPost[], { side, brandName, creatorName }: { side: "creator" | "brand"; brandName: string; creatorName: string }) {
  const brand = side === "brand";
  const listed = posts.filter((p) => !(p.cancel && !p.cancel.allowed && p.cancel.reason === "finished"));
  const cards: DealCancelCard[] = listed.map((p) => {
    const c = p.cancel;
    let line: string;
    let stays = false;
    if (c && !c.allowed) {
      stays = true;
      line = c.reason === "go_ahead_running" ? `Stays held · ${brand ? `${creatorName} has` : "you have"} the go-ahead to post` : "Stays · it’s published";
    } else {
      line = p.held
        ? brand
          ? "Comes back to you"
          : `Goes back to ${brandName}`
        : c?.holdAttemptWaiting
          ? "Closes · we’ll also stop the hold waiting at PayPal"
          : "Closes · nothing is held yet";
    }
    return { deliverableId: p.deliverableId, name: NAME[p.platform], amount: formatAmount(p.amount), line, stays };
  });
  const going = cards.filter((c) => !c.stays).length;
  return {
    button: going > 0 ? "Cancel the deal" : null,
    cards,
    going: cards.filter((c) => !c.stays).map((c) => c.deliverableId),
    confirm: going === cards.length ? "Cancel the deal" : `Cancel ${going} post${going === 1 ? "" : "s"}`,
    noteLabel: `Add a note for ${brand ? creatorName : brandName} (optional)`,
  };
}
