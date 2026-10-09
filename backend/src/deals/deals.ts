/**
 * Deals (deal set-up spec DS-FR-13 to DS-FR-16). Every function takes the creator who is asking, and a
 * deal that is not theirs is treated exactly as one that does not exist (DS-BR-01).
 */
import type { PrismaClient } from "../generated/prisma/client";

/** The posts a deal can have for now. Reels wait for Instagram to be connected. */
export const PLATFORMS = ["youtube_video", "youtube_short"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Step = "checklist" | "invite" | "waiting_for_brand" | "changes_requested" | "agreed";
export type Reading = "idle" | "reading" | "done" | "failed";

/** A deal as the creator's pages build it, in the shape their client expects. */
export interface DealDraft {
  id: string;
  brandName: string;
  step: Step;
  deliverables: { id: string; platform: Platform }[];
  reading: Reading;
  items: never[];
  questions: never[];
  /** Whether the creator has marked the checklist ready. */
  ready: boolean;
}

/** One line of the deals list. */
export interface DealSummary {
  id: string;
  brandName: string;
  /** One short line of plain text for the list. */
  status: string;
  step: Step;
  deliverables: { id: string; platform: Platform; state: "no_draft" }[];
}

/** The deals list's line for each step of setting a deal up. */
const STATUS: Record<Step, string> = {
  checklist: "Checklist",
  invite: "Invite",
  waiting_for_brand: "Waiting for brand",
  changes_requested: "Changes asked",
  agreed: "Agreed",
};

export type ChangeRefused =
  | { refused: "not_found" }
  /** The posts can no longer change: the brief has been sent (DS-FR-16). */
  | { refused: "reading_started" }
  /** A post was sent with an id that is not one of this deal's. `index` is its place in what was sent. */
  | { refused: "unknown_post"; index: number };

const withPosts = { deliverables: { orderBy: { position: "asc" } } } as const;

export type Deals = ReturnType<typeof createDeals>;

export function createDeals(deps: { prisma: PrismaClient; now: () => Date }) {
  const { prisma, now } = deps;

  type Row = NonNullable<Awaited<ReturnType<typeof find>>>;

  const find = (creatorId: string, dealId: string) =>
    prisma.deal.findFirst({ where: { id: dealId, creatorId }, include: withPosts });

  const draftOf = (deal: Row): DealDraft => ({
    id: deal.id,
    brandName: deal.brandName,
    step: deal.step as Step,
    deliverables: deal.deliverables.map((post) => ({ id: post.id, platform: post.platform as Platform })),
    reading: deal.reading as Reading,
    items: [],
    questions: [],
    ready: deal.step !== "checklist",
  });

  return {
    /** Starts a deal at the checklist step (DS-FR-13). */
    async start(creatorId: string, input: { brandName: string; platforms: Platform[] }): Promise<DealDraft> {
      const deal = await prisma.deal.create({
        data: {
          creatorId,
          brandName: input.brandName,
          createdAt: now(),
          deliverables: { create: input.platforms.map((platform, position) => ({ platform, position })) },
        },
        include: withPosts,
      });
      return draftOf(deal);
    },

    /** The creator's own deals, newest first (DS-FR-14). */
    async list(creatorId: string): Promise<DealSummary[]> {
      const deals = await prisma.deal.findMany({ where: { creatorId }, orderBy: { createdAt: "desc" }, include: withPosts });
      return deals.map((deal) => ({
        id: deal.id,
        brandName: deal.brandName,
        status: STATUS[deal.step as Step],
        step: deal.step as Step,
        deliverables: deal.deliverables.map((post) => ({ id: post.id, platform: post.platform as Platform, state: "no_draft" })),
      }));
    },

    /** One deal, if it is this creator's (DS-FR-15). */
    async draft(creatorId: string, dealId: string): Promise<DealDraft | undefined> {
      const deal = await find(creatorId, dealId);
      return deal ? draftOf(deal) : undefined;
    },

    /**
     * Changes the brand's name and the posts (DS-FR-16). A post sent with its id keeps it; one sent
     * without is new; one left out is removed. Allowed only until the brief has been sent.
     */
    async change(
      creatorId: string,
      dealId: string,
      input: { brandName: string; posts: { id?: string; platform: Platform }[] },
    ): Promise<DealDraft | ChangeRefused> {
      return prisma.$transaction(async (tx) => {
        const deal = await tx.deal.findFirst({ where: { id: dealId, creatorId }, include: withPosts });
        if (!deal) return { refused: "not_found" };
        const settled = deal.step === "checklist" && (deal.reading === "idle" || deal.reading === "failed");
        if (!settled) return { refused: "reading_started" };

        const own = new Set(deal.deliverables.map((post) => post.id));
        const unknown = input.posts.findIndex((post) => post.id !== undefined && !own.has(post.id));
        if (unknown !== -1) return { refused: "unknown_post", index: unknown };

        const kept = input.posts.flatMap((post) => (post.id ? [post.id] : []));
        await tx.deliverable.deleteMany({ where: { dealId, id: { notIn: kept } } });
        for (const [position, post] of input.posts.entries()) {
          if (post.id) await tx.deliverable.update({ where: { id: post.id }, data: { platform: post.platform, position } });
          else await tx.deliverable.create({ data: { dealId, platform: post.platform, position } });
        }
        const changed = await tx.deal.update({ where: { id: dealId }, data: { brandName: input.brandName }, include: withPosts });
        return draftOf(changed);
      });
    },
  };
}
