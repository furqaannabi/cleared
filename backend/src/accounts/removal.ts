/**
 * Taking an account away from Cleared (account and history spec AH-FR-10 to AH-FR-22): disconnecting
 * YouTube or Instagram, and deleting the account.
 *
 * Disconnecting is refused while a post on that platform is under way. Otherwise Cleared's own copy
 * of the access is deleted first, always, and only then is Google asked to revoke it, so a failure at
 * Google can never keep it (AH-BR-06;
 * docs/decisions/2026-10-12-disconnecting-deletes-then-revokes-at-google.md). Instagram has no call to
 * revoke: its token is deleted and ends on its own. A token is never logged or returned.
 *
 * Deleting is refused while anything is open, so the money path is left nothing to finish for a
 * creator who is gone (AH-BR-02). Otherwise everything the creator made and said is deleted, and for
 * each post that was ever held its money records stay exactly as they were, with the deal's and the
 * post's ids, the brand's name and the platform, and with no name or email left on any of it
 * (docs/decisions/2026-10-12-deleting-an-account-keeps-the-money-records.md). Nothing here moves
 * money or changes a money state (AH-BR-01).
 */
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import type { GooglePort } from "../google/port";
import { enqueue, type JobHandlers } from "../jobs/jobs";
import type { Money } from "../money/money";
import type { Secrets } from "../secrets/secrets";
import type { Storage } from "../storage/port";
import { accountOf, postsUnderWay, type AccountPlatform, type PostUnderWay } from "./under-way";

export type DisconnectRefused = { refused: "post_under_way"; blocking: PostUnderWay[] };

/** A deal in the way of deleting, and the first reason that applies (AH-FR-16). */
export interface DealInTheWay {
  dealId: string;
  /** The brand's name as the creator typed it: untrusted plain text. */
  brandName: string;
  /** held: a post is held. payout: a hold was taken and its payout is not settled. waiting_for_brand: the brand has the terms, or agreed and may still hold. */
  why: "held" | "payout" | "waiting_for_brand";
}

export type DeleteRefused = { refused: "not_found" } | { refused: "deal_open"; blocking: DealInTheWay[] };

/** The stages at which a post has, or had, a hold and is finished. Its money records are kept. */
const FINISHED_HELD = ["paid", "released", "approved_not_paid"];
const FILES_JOB = "account_files";

export type AccountRemoval = ReturnType<typeof createAccountRemoval>;

export function createAccountRemoval(deps: {
  prisma: PrismaClient;
  /** Asked to revoke a YouTube connection's access once it is deleted here. Without it nothing is asked. */
  google?: Pick<GooglePort, "revoke">;
  /** Decrypts the stored access so it can be handed back to Google to revoke. */
  secrets?: Secrets;
  /** Removes the creator's PayPal email from the money records that are kept (AH-FR-18). */
  money?: Pick<Money, "forgetCreatorIn">;
  /** Where drafts are kept. A deleted account's files are deleted from it by a job (AH-FR-20). */
  storage?: Pick<Storage, "deleteUnder">;
  now?: () => Date;
  /** Told what happened, with ids, counts and the platform only. Never a name or an email (AH-BR-10). */
  log?: (message: string, details: Record<string, unknown>) => void;
}) {
  const { prisma, google, secrets, money, storage, log } = deps;
  const now = deps.now ?? (() => new Date());

  /** Hands a stored token back to Google to revoke, once. A no changes nothing: Cleared's copy is already gone. */
  async function revokeAtGoogle(creatorId: string, encrypted: string | null | undefined): Promise<void> {
    if (!google || !secrets || !encrypted) return;
    let token: string | undefined;
    try {
      token = await secrets.decrypt(encrypted);
    } catch {
      // Stored under a key that is gone. There is nothing to hand back.
    }
    const revoked = token ? await google.revoke(token).catch(() => false) : false;
    log?.("Google was asked to revoke an account's access", { creatorId, revoked });
  }

  /**
   * What stops this creator's account being deleted, deal by deal (AH-FR-16). Read inside the change
   * that deletes, with the rows locked, so nothing can open between looking and deleting.
   */
  async function inTheWayIn(tx: Prisma.TransactionClient, creatorId: string): Promise<{ blocking: DealInTheWay[]; deals: { id: string; posts: { id: string; stage: string | undefined }[] }[] }> {
    const deals = await tx.deal.findMany({ where: { creatorId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { deliverables: { orderBy: { position: "asc" } } } });
    const postIds = deals.flatMap((deal) => deal.deliverables.map((post) => post.id));
    // The money rows are locked: a hold, a capture or a payout that is being recorded waits, and is then seen.
    const stages = new Map(
      postIds.length === 0
        ? []
        : (await tx.$queryRaw<{ deliverableId: string; stage: string }[]>`SELECT "deliverableId", "stage" FROM "DeliverableMoney" WHERE "deliverableId" IN (${Prisma.join(postIds)}) FOR UPDATE`).map((row) => [row.deliverableId, row.stage]),
    );
    const cancelled = new Set((await tx.postCancel.findMany({ where: { deliverableId: { in: postIds } }, select: { deliverableId: true } })).map((row) => row.deliverableId));
    // Something asked of PayPal about a post that was never held, and not yet answered: the brand's attempt is not over.
    const asked = new Set((await tx.payPalCall.findMany({ where: { deliverableId: { in: postIds }, status: "started" }, select: { deliverableId: true } })).map((call) => call.deliverableId));

    const blocking: DealInTheWay[] = [];
    for (const deal of deals) {
      const stageOf = (post: { id: string }) => stages.get(post.id);
      const posts = deal.deliverables;
      const why = posts.some((post) => stageOf(post) === "held")
        ? ("held" as const)
        : posts.some((post) => stageOf(post) === "captured")
          ? ("payout" as const)
          : // The brand has the terms and at least one post it could still agree to; or it agreed, and a post is neither held nor closed.
            (deal.step === "waiting_for_brand" && !deal.revising && posts.some((post) => !cancelled.has(post.id))) ||
              (deal.step === "agreed" && posts.some((post) => stageOf(post) === "not_held")) ||
              posts.some((post) => asked.has(post.id) && !FINISHED_HELD.includes(stageOf(post) ?? ""))
            ? ("waiting_for_brand" as const)
            : undefined;
      if (why) blocking.push({ dealId: deal.id, brandName: deal.brandName, why });
    }
    return { blocking, deals: deals.map((deal) => ({ id: deal.id, posts: deal.deliverables.map((post) => ({ id: post.id, stage: stages.get(post.id) })) })) };
  }

  const handlers: JobHandlers = {
    /** Deletes a deleted account's files from the bucket: every draft, and anything read from one (AH-FR-20). It is tried again until done. */
    async [FILES_JOB](payload) {
      const ids = (payload as { deliverableIds?: unknown } | null)?.deliverableIds;
      if (!Array.isArray(ids) || !storage) return;
      for (const id of ids) {
        if (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id)) continue;
        await storage.deleteUnder(`drafts/${id}/`);
        await storage.deleteUnder(`live/${id}/`);
      }
    },
  };

  return {
    /** The jobs this module schedules. */
    handlers,

    /**
     * Deletes a creator's account (AH-FR-15 to AH-FR-21). The records go in one change, at once. The
     * files go by a job written in that change. Google is asked to revoke afterwards.
     */
    async deleteAccount(creatorId: string): Promise<{ deleted: true } | DeleteRefused> {
      const done = await prisma.$transaction(async (tx) => {
        // One at a time for a creator, and nothing of theirs changes while this looks.
        const [creator] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Creator" WHERE "id" = ${creatorId} FOR UPDATE`;
        if (!creator) return { refused: "not_found" as const };
        const { blocking, deals } = await inTheWayIn(tx, creatorId);
        if (blocking.length > 0) return { refused: "deal_open" as const, blocking };

        const youtube = await tx.connectedAccount.findUnique({ where: { creatorId_platform: { creatorId, platform: "youtube" } }, select: { refreshTokenEncrypted: true } });
        const everyPost = deals.flatMap((deal) => deal.posts.map((post) => post.id));
        const kept = deals.flatMap((deal) => deal.posts.filter((post) => FINISHED_HELD.includes(post.stage ?? "")).map((post) => post.id));
        const notKept = everyPost.filter((id) => !kept.includes(id));
        const keptDeals = deals.filter((deal) => deal.posts.some((post) => kept.includes(post.id))).map((deal) => deal.id);
        const everyDeal = deals.map((deal) => deal.id);
        const goneDeals = everyDeal.filter((id) => !keptDeals.includes(id));

        // What was made and said for each post: drafts, what the checks found, the published post, notes and notices.
        const ofPosts = { where: { deliverableId: { in: everyPost } } };
        await tx.draft.deleteMany(ofPosts);
        await tx.checkItem.deleteMany(ofPosts);
        await tx.draftCheck.deleteMany(ofPosts);
        await tx.liveCheckItem.deleteMany(ofPosts);
        await tx.liveCheck.deleteMany(ofPosts);
        await tx.postVideo.deleteMany(ofPosts);
        await tx.postCancel.deleteMany(ofPosts);
        await tx.brandNotice.deleteMany(ofPosts);
        // And for each deal: the checklist, the questions, the terms as sent, the notes, and every link. A link's sessions go with it, so the brand's way in ends (AH-FR-19).
        const ofDeals = { where: { dealId: { in: everyDeal } } };
        await tx.checklistItem.deleteMany(ofDeals);
        await tx.question.deleteMany(ofDeals);
        await tx.termsVersion.deleteMany(ofDeals);
        await tx.note.deleteMany(ofDeals);
        await tx.inviteLink.deleteMany(ofDeals);

        // A post that never had a hold leaves nothing: not its row, not what the money path opened for it, not its timers.
        if (notKept.length > 0 || goneDeals.length > 0) {
          await tx.moneyRecord.deleteMany({ where: { deliverableId: { in: notKept } } });
          await tx.payPalCall.deleteMany({ where: { deliverableId: { in: notKept } } });
          await tx.deliverableMoney.deleteMany({ where: { deliverableId: { in: notKept } } });
          await tx.$executeRaw`DELETE FROM "Job" WHERE "status" = 'pending' AND ("payload"->>'deliverableId' = ANY(${notKept}) OR "payload"->>'dealId' = ANY(${goneDeals}))`;
          await tx.deliverable.deleteMany({ where: { id: { in: notKept } } });
          await tx.deal.deleteMany({ where: { id: { in: goneDeals } } });
        }

        // What is kept of a deal: its id, the brand's name and its dates. It points at nobody.
        await tx.deal.updateMany({ where: { id: { in: keptDeals } }, data: { creatorId: null, briefLines: Prisma.DbNull, brandEmail: null, brandNoticeEmail: null, timezone: null, revising: false } });
        // The money records stay as they were, but for the creator's PayPal email (AH-BR-03).
        for (const id of kept) {
          if (!money || !(await money.forgetCreatorIn(tx, id))) throw new Error("A kept post's money record could not be made anonymous, so nothing was deleted");
        }

        // The profile, with its sessions and its connected accounts and their tokens.
        await tx.creator.delete({ where: { id: creatorId } });
        if (everyPost.length > 0) await enqueue(tx, { name: FILES_JOB, payload: { deliverableIds: everyPost }, runAt: now() });
        return { deleted: true as const, token: youtube?.refreshTokenEncrypted, deals: everyDeal.length, kept: kept.length };
      });
      if ("refused" in done) return done;

      log?.("An account was deleted", { creatorId, deals: done.deals, postsKept: done.kept });
      await revokeAtGoogle(creatorId, done.token);
      return { deleted: true };
    },

    /**
     * Disconnects one of the creator's accounts (AH-FR-10). Asked for one that is not connected, it
     * changes nothing and says so.
     */
    async disconnect(creatorId: string, platform: AccountPlatform): Promise<{ disconnected: boolean } | DisconnectRefused> {
      const blocking = (await postsUnderWay(prisma, creatorId)).filter((post) => accountOf(post.platform) === platform);
      if (blocking.length > 0) return { refused: "post_under_way", blocking };

      const account = await prisma.connectedAccount.findUnique({ where: { creatorId_platform: { creatorId, platform } } });
      if (!account) return { disconnected: false };
      await prisma.connectedAccount.delete({ where: { id: account.id } });
      log?.("An account was disconnected", { creatorId, platform });

      // Cleared's copy is gone. Google is now asked, once, to withdraw what it gave (AH-FR-13).
      if (platform === "youtube") await revokeAtGoogle(creatorId, account.refreshTokenEncrypted);
      return { disconnected: true };
    },
  };
}
