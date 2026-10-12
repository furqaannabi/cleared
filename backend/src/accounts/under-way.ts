/**
 * Which of a creator's posts are under way: held, or taken and not yet paid (account and history spec
 * AH-FR-11). While one is, the account on its platform cannot be disconnected. The stage is read as
 * the money path records it; nothing is decided here (AH-BR-01).
 */
import type { PrismaClient } from "../generated/prisma/client";

export type AccountPlatform = "youtube" | "instagram";

/** The account each kind of post is published on. */
const ACCOUNT_OF: Record<string, AccountPlatform> = { youtube_video: "youtube", youtube_short: "youtube", instagram_reel: "instagram" };
export const accountOf = (postPlatform: string): AccountPlatform | undefined => ACCOUNT_OF[postPlatform];

/** A hold is in place, or was taken and its payout has not arrived. Released, closed and paid posts are over. */
const UNDER_WAY = ["held", "captured"];

export interface PostUnderWay {
  dealId: string;
  deliverableId: string;
  /** The brand's name as the creator typed it: untrusted plain text. */
  brandName: string;
  /** The post's own platform: a YouTube video, a Short or a Reel. */
  platform: string;
}

/** A creator's posts that are under way, oldest deal first and each deal's posts in their own order. */
export async function postsUnderWay(prisma: PrismaClient, creatorId: string): Promise<PostUnderWay[]> {
  const posts = await prisma.deliverable.findMany({
    where: { deal: { creatorId } },
    include: { deal: { select: { brandName: true, createdAt: true } } },
    orderBy: [{ deal: { createdAt: "asc" } }, { dealId: "asc" }, { position: "asc" }],
  });
  const stages = await prisma.deliverableMoney.findMany({ where: { deliverableId: { in: posts.map((post) => post.id) }, stage: { in: UNDER_WAY } }, select: { deliverableId: true } });
  const underWay = new Set(stages.map((row) => row.deliverableId));
  return posts.filter((post) => underWay.has(post.id)).map((post) => ({ dealId: post.dealId, deliverableId: post.id, brandName: post.deal.brandName, platform: post.platform }));
}
