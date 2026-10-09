/**
 * The deal as its brand sees it (deal set-up spec DS-FR-36). Everything comes from the latest version
 * sent to the brand, so it is shown exactly what it is asked to agree to (DS-BR-10). The creator's
 * PayPal email, their own email and their accounts are never read here (DS-BR-13).
 */
import type { BriefLine } from "../briefs/reader";
import type { Platform } from "../deals/deals";
import type { PrismaClient } from "../generated/prisma/client";
import type { TermsSnapshot } from "../invites/terms";
import { decimal } from "../money/view";

export interface BrandDeal {
  dealId: string;
  creatorName: string;
  brandName: string;
  step: "waiting_for_brand" | "changes_requested" | "agreed";
  /** The version shown, which is the one the brand can agree to. */
  version: number;
  posts: {
    deliverableId: string;
    platform: Platform;
    /** US dollars, as a decimal string with two places (DS-BR-12). */
    amount: string;
    deadlineDays: number;
    /** No hold can be started before the brand agrees (DS-BR-10). */
    hold: { state: "not_started" };
  }[];
  items: {
    id: string;
    deliverableId: string;
    name: string;
    /** The brief line it cites. Absent only for an item the creator added. */
    briefLine?: number;
    addedByCreator: boolean;
  }[];
  /** The whole brief as numbered lines of plain text, so the lines no item cites can be shown too. */
  brief: BriefLine[];
  /** How the creator read each unclear line. An item citing one of these lines is the creator's reading of it. */
  answers: { briefLine: number; kind: "suggestion" | "own_words" | "left_out"; text?: string }[];
  notes: never[];
}

export type Brand = ReturnType<typeof createBrand>;

export function createBrand(deps: { prisma: PrismaClient }) {
  const { prisma } = deps;

  return {
    /** The deal, for a caller already known to hold a brand's session for it. */
    async deal(dealId: string): Promise<BrandDeal | undefined> {
      const deal = await prisma.deal.findUnique({
        where: { id: dealId },
        include: { creator: { select: { name: true } }, versions: { orderBy: { number: "desc" }, take: 1 } },
      });
      const version = deal?.versions[0];
      if (!deal || !version) return undefined;
      const sent = version.terms as unknown as TermsSnapshot;

      return {
        dealId: deal.id,
        creatorName: deal.creator.name,
        brandName: deal.brandName,
        step: deal.step as BrandDeal["step"],
        version: version.number,
        posts: sent.posts.map((post) => ({
          deliverableId: post.deliverableId,
          platform: post.platform as Platform,
          amount: decimal(post.amountCents),
          deadlineDays: post.deadlineDays,
          hold: { state: "not_started" },
        })),
        items: sent.items.map((item) => ({
          id: item.id,
          deliverableId: item.deliverableId,
          name: item.name,
          ...(item.briefLine === undefined ? {} : { briefLine: item.briefLine }),
          addedByCreator: item.source === "creator",
        })),
        brief: (deal.briefLines ?? []) as unknown as BriefLine[],
        answers: sent.answers as BrandDeal["answers"],
        notes: [],
      };
    },
  };
}
