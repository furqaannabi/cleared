/**
 * The brand's link to one post's review (draft check and review spec DR-FR-44, DR-FR-45). A fresh one
 * is made each time a draft needs the brand, and it follows the invite link's rules: the token is
 * worked out again for its creator and only its hash is kept (DS-FR-32, DS-BR-11). It opens the same
 * deal-scoped session and says which post to land on.
 */
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { freshLink, type LinkKeys } from "../invites/link-keys";
import type { Money } from "../money/money";
import { holdEnded, loadReview } from "./store";

type Db = Prisma.TransactionClient | PrismaClient;

/** The link as its creator sees it. */
export interface ReviewLink {
  url: string;
  expiresAt: string;
  expired: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewLinks = ReturnType<typeof createReviewLinks>;

export function createReviewLinks(deps: {
  prisma: PrismaClient;
  now: () => Date;
  /** The address of Cleared's own app, which a link opens. */
  appOrigin: string;
  /** Works out a link's token from its salt. Without it no link is made or shown. */
  linkKeys?: LinkKeys;
  money?: Pick<Money, "view">;
  /** How long a review link works for at most (DR-FR-45). */
  linkDays?: number;
}) {
  const { prisma, now, appOrigin, linkKeys, money } = deps;
  const linkDays = deps.linkDays ?? 7;

  /** The post's review links that could still open something. */
  const open = (deliverableId: string) => ({ deliverableId, closedAt: null, turnedOffAt: null });

  /**
   * Whether the brand has something left to do on the post. Before it is published: it is shown the
   * latest draft, the draft is not approved, and the hold is still in place (DR-FR-45). After: the
   * money path is waiting for it to confirm or to accept the live post, and its time is not up (PT-FR-20).
   */
  async function needed(db: Db, deliverableId: string): Promise<boolean> {
    const view = await money?.view(deliverableId);
    const waiting = view?.waitingOn;
    if (waiting?.for === "brand_to_confirm" || waiting?.for === "brand_to_accept") return now() < waiting.until;
    const released = holdEnded(view?.stage);
    const state = (await loadReview(db, deliverableId, released))?.state;
    return !!state && state.shown && state.phase === "done" && !state.approved && !state.released;
  }

  /**
   * Makes the post's link, in place of any it had. One made for a decision on the live post says so,
   * and works only until the brand's time is up (PT-FR-20).
   */
  async function make(tx: Prisma.TransactionClient, deliverableId: string, at: Date, livePost?: { until: Date }): Promise<void> {
    if (!linkKeys) return;
    const post = await tx.deliverable.findUniqueOrThrow({ where: { id: deliverableId } });
    await tx.inviteLink.updateMany({ where: open(deliverableId), data: { closedAt: at } });
    await tx.inviteLink.create({
      data: {
        dealId: post.dealId,
        deliverableId,
        ...(await freshLink(linkKeys)),
        createdAt: at,
        expiresAt: livePost ? livePost.until : new Date(at.getTime() + linkDays * DAY_MS),
        ...(livePost ? { reason: "live_post" } : {}),
      },
    });
  }

  return {
    needed: (deliverableId: string) => needed(prisma, deliverableId),
    make,

    /** The brand has nothing left to do on the draft: the link opens nothing new. Sessions already made from it go on. */
    async close(tx: Prisma.TransactionClient, deliverableId: string, at: Date): Promise<void> {
      await tx.inviteLink.updateMany({ where: open(deliverableId), data: { closedAt: at } });
    },

    /**
     * The address of the post's open link, for the one email that carries it (PT-FR-21). It is handed
     * to the email service and to nothing else: never logged, never stored.
     */
    async addressToSend(deliverableId: string): Promise<string | undefined> {
      if (!linkKeys) return undefined;
      const link = await prisma.inviteLink.findFirst({ where: open(deliverableId), orderBy: { createdAt: "desc" } });
      return link ? `${appOrigin}/b/${await linkKeys.token(link.salt)}` : undefined;
    },

    /**
     * The post's link for its creator, while the brand has something to do. One past its days is marked
     * expired. A link about the live post is the creator's to send only when no email could be (PT-FR-21).
     */
    async current(deliverableId: string): Promise<ReviewLink | undefined> {
      if (!linkKeys || !(await needed(prisma, deliverableId))) return undefined;
      const link = await prisma.inviteLink.findFirst({ where: open(deliverableId), orderBy: { createdAt: "desc" } });
      if (!link) return undefined;
      if (link.reason === "live_post") {
        const notice = await prisma.brandNotice.findFirst({ where: { deliverableId }, orderBy: { createdAt: "desc" } });
        if (notice?.sentTo !== "none") return undefined;
      }
      return { url: `${appOrigin}/b/${await linkKeys.token(link.salt)}`, expiresAt: link.expiresAt.toISOString(), expired: link.expiresAt <= now() };
    },

    /**
     * The creator makes a new link: because the old one expired, or because it went to the wrong
     * person. The old one is turned off, which also ends every session made from it (DS-FR-33).
     */
    async renew(creatorId: string, deliverableId: string): Promise<"made" | { refused: "not_found" | "nothing_for_brand" | "not_set_up" }> {
      if ((await prisma.deliverable.count({ where: { id: deliverableId, deal: { creatorId } } })) !== 1) return { refused: "not_found" };
      if (!linkKeys) return { refused: "not_set_up" };
      if (!(await needed(prisma, deliverableId))) return { refused: "nothing_for_brand" };
      const at = now();
      await prisma.$transaction(async (tx) => {
        const old = await tx.inviteLink.findMany({ where: { deliverableId, turnedOffAt: null }, select: { id: true } });
        await tx.inviteLink.updateMany({ where: { id: { in: old.map((link) => link.id) } }, data: { turnedOffAt: at, closedAt: at } });
        await tx.session.deleteMany({ where: { linkId: { in: old.map((link) => link.id) } } });
        // A link about the live post keeps to the brand's time (PT-FR-20).
        const waiting = (await money?.view(deliverableId))?.waitingOn;
        await make(tx, deliverableId, at, waiting?.for === "brand_to_confirm" || waiting?.for === "brand_to_accept" ? { until: waiting.until } : undefined);
      });
      return "made";
    },
  };
}
